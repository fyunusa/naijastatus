/**
 * isp-checker.js
 * 
 * Core ISP status check engine.
 * Drop this into your src/ folder and import where needed.
 * 
 * Usage:
 *   import { runISPCheck, runAllISPChecks } from './isp-checker.js'
 * 
 *   // Check a single ISP
 *   const result = await runISPCheck('MTN')
 *   console.log(result.status)   // 'OPERATIONAL' | 'UNSTABLE' | 'DEGRADED' | 'LIKELY_OUTAGE' | 'OUTAGE_CONFIRMED'
 *   console.log(result.score)    // 0.0 – 1.0
 * 
 *   // Check all ISPs at once
 *   const allResults = await runAllISPChecks()
 */

import {
  ISP_PROBES,
  NEUTRAL_PROBES,
  LATENCY_PENALTY,
  STATUS_THRESHOLDS,
} from './isp-probes.config.js'

// ─────────────────────────────────────────────
// PHASE 1 — Device Pre-Check
// ─────────────────────────────────────────────

function checkDeviceOnline() {
  // navigator.onLine is unreliable alone but useful as a fast gate
  if (!navigator.onLine) {
    return { online: false, reason: 'DEVICE_OFFLINE' }
  }

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  const deviceSignal = conn
    ? {
        effectiveType: conn.effectiveType || 'unknown',
        downlink:      conn.downlink      || null,
        rtt:           conn.rtt           || null,
        saveData:      conn.saveData      || false,
      }
    : { effectiveType: 'unknown', downlink: null, rtt: null }

  // Flag pre-existing degradation from device signal
  const preDegraded = deviceSignal.rtt && deviceSignal.rtt > 2000

  return { online: true, deviceSignal, preDegraded }
}

// ─────────────────────────────────────────────
// PHASE 2 — Neutral Reference Probes
// ─────────────────────────────────────────────

async function probeNeutralTargets() {
  const results = await Promise.allSettled(
    NEUTRAL_PROBES.map(async ({ url, label }) => {
      const start = Date.now()
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: url.includes('dns-query') || url.includes('dns.google')
            ? { Accept: 'application/dns-json' }
            : {},
          signal: AbortSignal.timeout(5000),
          // no-cors for IP-only targets like 1.1.1.1
          mode: url.startsWith('https://1.') ? 'no-cors' : 'cors',
        })
        return { label, success: true, latency: Date.now() - start, status: res.status }
      } catch {
        return { label, success: false, latency: null }
      }
    })
  )

  const probes = results.map(r => r.value || { success: false, latency: null })
  const successful = probes.filter(p => p.success)
  const avgLatency = successful.length > 0
    ? successful.reduce((s, p) => s + p.latency, 0) / successful.length
    : null

  return {
    probes,
    successCount: successful.length,
    totalCount:   NEUTRAL_PROBES.length,
    avgLatency,   // this is neutralBaseline
    userOnline:   successful.length >= 2,  // need at least 2/3 to pass
  }
}

// ─────────────────────────────────────────────
// PHASE 3 — Single Probe Runner
// ─────────────────────────────────────────────

async function runSingleProbe(key, config) {
  const start = Date.now()

  try {
    const headers = config.type === 'dns'
      ? { Accept: 'application/dns-json' }
      : {}

    const res = await fetch(config.url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(config.timeout),
      // DNS probes are CORS-safe. HTTP probes may get blocked but
      // the fetch will still throw on network failure vs CORS — we use
      // that signal. A CORS block means the server answered = ISP is up.
      mode: 'cors',
    })

    const latency = Date.now() - start

    // For DNS probes: validate the answer exists
    if (config.type === 'dns') {
      try {
        const data = await res.json()
        const hasAnswer = data && data.Answer && data.Answer.length > 0
        return { key, success: hasAnswer, latency, type: config.type }
      } catch {
        // JSON parse failed = unexpected response but server answered
        return { key, success: false, latency, type: config.type }
      }
    }

    return { key, success: res.ok || res.status > 0, latency, type: config.type }

  } catch (err) {
    const latency = Date.now() - start
    const isCors = err.message?.includes('CORS') || err.message?.includes('NetworkError')

    // CORS error = server responded = ISP is up (request reached the server)
    // Timeout/network error = ISP may be unreachable
    if (isCors) {
      return { key, success: true, latency, type: config.type, note: 'cors_blocked_but_alive' }
    }

    return { key, success: false, latency: null, type: config.type, error: err.message }
  }
}

// ─────────────────────────────────────────────
// PHASE 4 — Run All Probes for One ISP
// ─────────────────────────────────────────────

async function runISPProbes(ispKey) {
  const config  = ISP_PROBES[ispKey]
  const entries = Object.entries(config.probes)

  // Run all probes concurrently
  const results = await Promise.allSettled(
    entries.map(([key, probe]) => runSingleProbe(key, probe))
  )

  const probeResults = {}
  results.forEach((r, i) => {
    const [key] = entries[i]
    probeResults[key] = r.status === 'fulfilled'
      ? r.value
      : { key, success: false, latency: null, error: 'promise_rejected' }
  })

  return probeResults
}

// ─────────────────────────────────────────────
// PHASE 5 — Weighted Score + Latency Penalty
// ─────────────────────────────────────────────

function computeScore(ispKey, probeResults, neutralBaseline) {
  const probeConfig = ISP_PROBES[ispKey].probes
  let rawScore = 0

  for (const [key, result] of Object.entries(probeResults)) {
    const weight = probeConfig[key]?.weight || 0
    if (result.success) rawScore += weight
  }

  // Latency penalty
  const successfulProbes = Object.values(probeResults).filter(p => p.success && p.latency)
  const avgISPLatency = successfulProbes.length > 0
    ? successfulProbes.reduce((s, p) => s + p.latency, 0) / successfulProbes.length
    : null

  let penaltyMultiplier = 1.0
  let latencyRatio = null

  if (avgISPLatency && neutralBaseline) {
    latencyRatio = avgISPLatency / neutralBaseline

    if      (latencyRatio >= LATENCY_PENALTY.SEVERE.ratio) penaltyMultiplier = LATENCY_PENALTY.SEVERE.multiplier
    else if (latencyRatio >= LATENCY_PENALTY.MILD.ratio)   penaltyMultiplier = LATENCY_PENALTY.MILD.multiplier
  }

  const finalScore = Math.min(1.0, Math.max(0.0, rawScore * penaltyMultiplier))

  return { rawScore, finalScore, latencyRatio, penaltyMultiplier, avgISPLatency }
}

// ─────────────────────────────────────────────
// PHASE 6 — Corroboration Rule
// ─────────────────────────────────────────────

function checkCorroboration(probeResults) {
  // HTTP type failures: both http_primary AND http_secondary failed
  const httpProbes = Object.values(probeResults).filter(p => p.type === 'http')
  const httpFailed = httpProbes.length >= 2 && httpProbes.every(p => !p.success)

  // DNS type failures: both dns probes failed
  const dnsProbes = Object.values(probeResults).filter(p => p.type === 'dns')
  const dnsFailed = dnsProbes.length >= 2 && dnsProbes.every(p => !p.success)

  return {
    httpFailed,
    dnsFailed,
    // Multi-layer = both HTTP and DNS independently failed
    multiLayerFailure: httpFailed && dnsFailed,
    // Single-layer = only one type failed
    singleLayerFailure: (httpFailed || dnsFailed) && !(httpFailed && dnsFailed),
  }
}

// ─────────────────────────────────────────────
// PHASE 7 — Final Status Decision
// ─────────────────────────────────────────────

function resolveStatus(score, corroboration) {
  const { multiLayerFailure, singleLayerFailure } = corroboration

  if (score >= STATUS_THRESHOLDS.OPERATIONAL) return 'OPERATIONAL'
  if (score >= STATUS_THRESHOLDS.UNSTABLE)    return 'UNSTABLE'

  if (score >= STATUS_THRESHOLDS.DEGRADED) {
    return multiLayerFailure ? 'LIKELY_OUTAGE' : 'DEGRADED'
  }

  // score < 0.30
  if (multiLayerFailure)  return 'OUTAGE_CONFIRMED'
  if (singleLayerFailure) return 'DEGRADED'  // not enough evidence to call outage

  return 'DEGRADED'
}

// ─────────────────────────────────────────────
// PHASE 8 — Result Object Builder
// ─────────────────────────────────────────────

function buildResult({ ispKey, status, scoreData, probeResults, corroboration, deviceSignal, zone, testDuration }) {
  const config = ISP_PROBES[ispKey]

  return {
    isp:          ispKey,
    label:        config.label,
    status,                         // 'OPERATIONAL' | 'UNSTABLE' | 'DEGRADED' | 'LIKELY_OUTAGE' | 'OUTAGE_CONFIRMED'
    score:        parseFloat(scoreData.finalScore.toFixed(3)),
    rawScore:     parseFloat(scoreData.rawScore.toFixed(3)),
    latencyRatio: scoreData.latencyRatio ? parseFloat(scoreData.latencyRatio.toFixed(2)) : null,
    avgISPLatency: scoreData.avgISPLatency,
    corroboration: {
      httpFailed:        corroboration.httpFailed,
      dnsFailed:         corroboration.dnsFailed,
      multiLayerFailure: corroboration.multiLayerFailure,
    },
    probeResults,                   // individual probe breakdown
    deviceSignal,                   // navigator.connection data
    zone:         zone || 'unknown',
    timestamp:    new Date().toISOString(),
    testDuration: `${testDuration}ms`,
  }
}

// ─────────────────────────────────────────────
// PUBLIC API — runISPCheck(ispKey, options?)
// ─────────────────────────────────────────────

/**
 * Run a full status check for a single ISP.
 * 
 * @param {string} ispKey  - e.g. 'MTN', 'AIRTEL', 'GLO', '9MOBILE'
 * @param {object} options - optional: { zone: 'Kano Municipal', neutralBaseline: 120 }
 * @returns {Promise<object>} Full result object
 */
export async function runISPCheck(ispKey, options = {}) {
  const start = Date.now()

  // Phase 1 — device gate
  const deviceCheck = checkDeviceOnline()
  if (!deviceCheck.online) {
    return {
      isp: ispKey,
      label: ISP_PROBES[ispKey]?.label || ispKey,
      status: 'DEVICE_OFFLINE',
      score: 0,
      reason: deviceCheck.reason,
      timestamp: new Date().toISOString(),
    }
  }

  // Phase 2 — neutral baseline (unless pre-supplied)
  let neutralBaseline = options.neutralBaseline || null
  let userOnline = true

  if (!neutralBaseline) {
    const neutral = await probeNeutralTargets()
    neutralBaseline = neutral.avgLatency
    userOnline      = neutral.userOnline

    if (!userOnline) {
      return {
        isp: ispKey,
        label: ISP_PROBES[ispKey]?.label || ispKey,
        status: 'NO_INTERNET',
        score: 0,
        neutralProbes: neutral.probes,
        timestamp: new Date().toISOString(),
      }
    }
  }

  // Phase 3 — ISP probes
  const probeResults  = await runISPProbes(ispKey)

  // Phase 4+5 — score
  const scoreData     = computeScore(ispKey, probeResults, neutralBaseline)

  // Phase 6 — corroboration
  const corroboration = checkCorroboration(probeResults)

  // Phase 7 — status
  const status        = resolveStatus(scoreData.finalScore, corroboration)

  // Phase 8 — result
  return buildResult({
    ispKey,
    status,
    scoreData,
    probeResults,
    corroboration,
    deviceSignal: deviceCheck.deviceSignal,
    zone:         options.zone || null,
    testDuration: Date.now() - start,
  })
}

// ─────────────────────────────────────────────
// PUBLIC API — runAllISPChecks(options?)
// ─────────────────────────────────────────────

/**
 * Run checks for all ISPs concurrently.
 * Shares a single neutral baseline probe to save requests.
 * 
 * @param {object} options - optional: { zone: 'Lagos Island' }
 * @returns {Promise<object>} { MTN: result, AIRTEL: result, GLO: result, '9MOBILE': result }
 */
export async function runAllISPChecks(options = {}) {
  // Device gate
  const deviceCheck = checkDeviceOnline()
  if (!deviceCheck.online) {
    const offline = {}
    for (const key of Object.keys(ISP_PROBES)) {
      offline[key] = { isp: key, status: 'DEVICE_OFFLINE', score: 0, timestamp: new Date().toISOString() }
    }
    return offline
  }

  // Run neutral probes once, share result across all ISP checks
  const neutral = await probeNeutralTargets()

  if (!neutral.userOnline) {
    const noInternet = {}
    for (const key of Object.keys(ISP_PROBES)) {
      noInternet[key] = { isp: key, status: 'NO_INTERNET', score: 0, timestamp: new Date().toISOString() }
    }
    return noInternet
  }

  // Run all ISP checks concurrently, share neutralBaseline
  const entries = Object.keys(ISP_PROBES)
  const results = await Promise.allSettled(
    entries.map(key =>
      runISPCheck(key, {
        ...options,
        neutralBaseline: neutral.avgLatency,  // skip re-running neutral probes per ISP
      })
    )
  )

  const output = {}
  entries.forEach((key, i) => {
    output[key] = results[i].status === 'fulfilled'
      ? results[i].value
      : { isp: key, status: 'CHECK_FAILED', score: 0, timestamp: new Date().toISOString() }
  })

  return output
}

// ─────────────────────────────────────────────
// PUBLIC API — getStatusMeta(status)
// ─────────────────────────────────────────────

/**
 * Get display-ready metadata for a status string.
 * Useful for rendering badges/icons in your UI.
 */
export function getStatusMeta(status) {
  const map = {
    OPERATIONAL:      { label: 'Operational',      color: '#43A047', icon: '✅', severity: 0 },
    UNSTABLE:         { label: 'Unstable',          color: '#FFA726', icon: '⚠️',  severity: 1 },
    DEGRADED:         { label: 'Degraded',          color: '#EF6C00', icon: '🔶', severity: 2 },
    LIKELY_OUTAGE:    { label: 'Likely Outage',     color: '#E53935', icon: '🔴', severity: 3 },
    OUTAGE_CONFIRMED: { label: 'Outage Confirmed',  color: '#B71C1C', icon: '🚨', severity: 4 },
    NO_INTERNET:      { label: 'No Internet',       color: '#757575', icon: '📵', severity: 5 },
    DEVICE_OFFLINE:   { label: 'Device Offline',    color: '#757575', icon: '📴', severity: 5 },
    CHECK_FAILED:     { label: 'Check Failed',      color: '#9E9E9E', icon: '❓', severity: -1 },
  }
  return map[status] || map['CHECK_FAILED']
}
