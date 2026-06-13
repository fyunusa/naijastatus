/**
 * bank-checker.js
 *
 * Bank & ecosystem status check engine.
 *
 * Usage:
 *   import { runBankCheck, runAllBankChecks, runEcosystemCheck } from './bank-checker.js'
 *
 *   // Single bank
 *   const result = await runBankCheck('GTBANK')
 *
 *   // All banks concurrently
 *   const all = await runAllBankChecks()
 *
 *   // Ecosystem (NIBSS, Paystack, Flutterwave, Interswitch)
 *   const eco = await runEcosystemCheck()
 */

import {
  BANK_PROBES,
  ECOSYSTEM_PROBES,
  BANK_STATUS_THRESHOLDS,
  INSTATUS_MAP,
  ATLASSIAN_MAP,
} from './bank-probes.config.js'

// ─────────────────────────────────────────────
// PROBE RUNNERS
// ─────────────────────────────────────────────

async function runHTTPProbe(key, config) {
  const start = Date.now()
  try {
    const res = await fetch(config.url, {
      method: 'GET',
      signal: AbortSignal.timeout(config.timeout),
      mode: 'cors',
    })
    const latency = Date.now() - start
    // CORS block still means server answered = service is alive
    return { key, success: true, latency, httpStatus: res.status, type: 'http' }
  } catch (err) {
    const latency = Date.now() - start
    const isCors = err.message?.includes('CORS') || err.message?.includes('NetworkError')
    if (isCors) {
      return { key, success: true, latency, httpStatus: null, type: 'http', note: 'cors_alive' }
    }
    return { key, success: false, latency: null, type: 'http', error: err.message }
  }
}

async function runDNSProbe(key, config) {
  const start = Date.now()
  try {
    const res = await fetch(config.url, {
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(config.timeout),
    })
    const latency = Date.now() - start
    const data = await res.json()
    const hasAnswer = data?.Answer?.length > 0
    return { key, success: hasAnswer, latency, type: 'dns' }
  } catch (err) {
    return { key, success: false, latency: null, type: 'dns', error: err.message }
  }
}

// ─────────────────────────────────────────────
// GATEWAY STATUS API RUNNERS
// Real data — not inferred from HTTP probes
// ─────────────────────────────────────────────

async function runInstatusAPI(config) {
  /**
   * Instatus public API — no auth required.
   * Endpoint: https://{subdomain}.instatus.com/v3/summary.json
   *
   * Response shape:
   * {
   *   page: { status: 'UP' | 'HASISSUES' | 'UNDERMAINTENANCE' },
   *   activeIncidents: [...],
   *   activeMaintenances: [...]
   * }
   */
  try {
    const res = await fetch(config.url, {
      signal: AbortSignal.timeout(config.timeout),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    const pageStatus    = data?.page?.status || 'UP'
    const incidents     = data?.activeIncidents    || []
    const maintenances  = data?.activeMaintenances || []

    return {
      source:       'instatus_api',
      raw:          pageStatus,
      status:       INSTATUS_MAP[pageStatus] || 'UNKNOWN',
      incidents:    incidents.map(i => ({
        name:    i.name,
        impact:  i.impact,
        started: i.started,
        url:     i.url,
      })),
      maintenances: maintenances.map(m => ({
        name:  m.name,
        start: m.start,
        url:   m.url,
      })),
      success: true,
    }
  } catch (err) {
    return { source: 'instatus_api', success: false, error: err.message, status: 'UNKNOWN' }
  }
}

async function runAtlassianAPI(config) {
  /**
   * Atlassian Statuspage public API — no auth required.
   * Endpoint: https://{domain}/api/v2/summary.json
   *
   * Response shape:
   * {
   *   status: { indicator: 'none'|'minor'|'major'|'critical', description: '...' },
   *   incidents: [...],
   *   scheduled_maintenances: [...]
   * }
   */
  try {
    const res = await fetch(config.url, {
      signal: AbortSignal.timeout(config.timeout),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    const indicator  = data?.status?.indicator || 'none'
    const incidents  = data?.incidents         || []
    const maintenances = data?.scheduled_maintenances || []

    return {
      source:       'atlassian_api',
      raw:          indicator,
      status:       ATLASSIAN_MAP[indicator] || 'UNKNOWN',
      description:  data?.status?.description || '',
      incidents:    incidents.map(i => ({
        name:   i.name,
        impact: i.impact,
        url:    i.shortlink,
      })),
      maintenances: maintenances.map(m => ({
        name:         m.name,
        scheduledFor: m.scheduled_for,
      })),
      success: true,
    }
  } catch (err) {
    return { source: 'atlassian_api', success: false, error: err.message, status: 'UNKNOWN' }
  }
}

// ─────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────

function scoreProbeResults(probeResults, probeConfig) {
  let score = 0
  let httpFailed = true
  let dnsFailed  = true

  const httpProbes = []
  const dnsProbes  = []

  for (const [key, result] of Object.entries(probeResults)) {
    const weight = probeConfig[key]?.weight || 0
    if (result.success) score += weight
    if (result.type === 'http') httpProbes.push(result)
    if (result.type === 'dns')  dnsProbes.push(result)
  }

  if (httpProbes.length > 0) httpFailed = httpProbes.every(p => !p.success)
  if (dnsProbes.length > 0)  dnsFailed  = dnsProbes.every(p => !p.success)

  const multiLayerFailure = httpFailed && dnsFailed

  return {
    score:             Math.min(1.0, Math.max(0.0, score)),
    httpFailed,
    dnsFailed,
    multiLayerFailure,
  }
}

function resolveStatus(score, multiLayerFailure) {
  if (score >= BANK_STATUS_THRESHOLDS.OPERATIONAL) return 'OPERATIONAL'
  if (score >= BANK_STATUS_THRESHOLDS.UNSTABLE)    return 'UNSTABLE'
  if (score >= BANK_STATUS_THRESHOLDS.DEGRADED) {
    return multiLayerFailure ? 'LIKELY_OUTAGE' : 'DEGRADED'
  }
  return multiLayerFailure ? 'OUTAGE_CONFIRMED' : 'DEGRADED'
}

// ─────────────────────────────────────────────
// PUBLIC — runBankCheck(bankKey)
// ─────────────────────────────────────────────

/**
 * Run a full status check for a single bank.
 *
 * @param {string} bankKey — e.g. 'GTBANK', 'ZENITH', 'KUDA'
 * @returns {Promise<object>}
 */
export async function runBankCheck(bankKey) {
  const start  = Date.now()
  const config = BANK_PROBES[bankKey]
  if (!config) throw new Error(`Unknown bank key: ${bankKey}`)

  // Run all probes concurrently
  const entries = Object.entries(config.probes)
  const settled = await Promise.allSettled(
    entries.map(([key, probe]) =>
      probe.type === 'http' ? runHTTPProbe(key, probe) : runDNSProbe(key, probe)
    )
  )

  const probeResults = {}
  settled.forEach((r, i) => {
    const [key] = entries[i]
    probeResults[key] = r.status === 'fulfilled'
      ? r.value
      : { key, success: false, latency: null, error: 'promise_rejected' }
  })

  const { score, httpFailed, dnsFailed, multiLayerFailure } =
    scoreProbeResults(probeResults, config.probes)

  const status = resolveStatus(score, multiLayerFailure)

  return {
    bank:          bankKey,
    label:         config.label,
    tier:          config.tier,
    status,
    score:         parseFloat(score.toFixed(3)),
    probeResults,
    corroboration: { httpFailed, dnsFailed, multiLayerFailure },
    timestamp:     new Date().toISOString(),
    testDuration:  `${Date.now() - start}ms`,
  }
}

// ─────────────────────────────────────────────
// PUBLIC — runAllBankChecks()
// ─────────────────────────────────────────────

/**
 * Run checks for all banks concurrently.
 *
 * @returns {Promise<object>} { GTBANK: result, ZENITH: result, ... }
 */
export async function runAllBankChecks() {
  const keys    = Object.keys(BANK_PROBES)
  const settled = await Promise.allSettled(keys.map(key => runBankCheck(key)))

  const output = {}
  keys.forEach((key, i) => {
    output[key] = settled[i].status === 'fulfilled'
      ? settled[i].value
      : { bank: key, status: 'CHECK_FAILED', score: 0, timestamp: new Date().toISOString() }
  })
  return output
}

// ─────────────────────────────────────────────
// PUBLIC — runEcosystemCheck()
// ─────────────────────────────────────────────

/**
 * Check NIBSS + Paystack + Flutterwave + Interswitch.
 * These are ecosystem-wide — not tied to a single bank.
 *
 * Paystack and Flutterwave use real status APIs (Instatus / Atlassian).
 * NIBSS and Interswitch use HTTP + DNS probes.
 *
 * @returns {Promise<object>}
 */
export async function runEcosystemCheck() {
  const start = Date.now()

  const [nibss, paystack, flutterwave, interswitch] = await Promise.allSettled([
    _checkNIBSS(),
    _checkPaystack(),
    _checkFlutterwave(),
    _checkInterswitch(),
  ])

  return {
    NIBSS:         nibss.status        === 'fulfilled' ? nibss.value        : _failed('NIBSS'),
    PAYSTACK:      paystack.status     === 'fulfilled' ? paystack.value     : _failed('PAYSTACK'),
    FLUTTERWAVE:   flutterwave.status  === 'fulfilled' ? flutterwave.value  : _failed('FLUTTERWAVE'),
    INTERSWITCH:   interswitch.status  === 'fulfilled' ? interswitch.value  : _failed('INTERSWITCH'),
    timestamp:     new Date().toISOString(),
    testDuration:  `${Date.now() - start}ms`,
  }
}

function _failed(key) {
  return { key, status: 'CHECK_FAILED', score: 0, timestamp: new Date().toISOString() }
}

async function _checkNIBSS() {
  const start  = Date.now()
  const config = ECOSYSTEM_PROBES.NIBSS
  const entries = Object.entries(config.probes)

  const settled = await Promise.allSettled(
    entries.map(([key, probe]) =>
      probe.type === 'http' ? runHTTPProbe(key, probe) : runDNSProbe(key, probe)
    )
  )

  const probeResults = {}
  settled.forEach((r, i) => {
    const [key] = entries[i]
    probeResults[key] = r.status === 'fulfilled' ? r.value : { success: false }
  })

  const { score, multiLayerFailure } = scoreProbeResults(probeResults, config.probes)

  return {
    key:          'NIBSS',
    label:        config.label,
    description:  config.description,
    status:       resolveStatus(score, multiLayerFailure),
    score:        parseFloat(score.toFixed(3)),
    probeResults,
    // NIBSS context: if this is down, tag ALL banks as "Transfers Affected"
    transfersAffected: score < BANK_STATUS_THRESHOLDS.DEGRADED,
    timestamp:    new Date().toISOString(),
    testDuration: `${Date.now() - start}ms`,
  }
}

async function _checkPaystack() {
  const start  = Date.now()
  const config = ECOSYSTEM_PROBES.PAYSTACK

  // Try real status API first
  const apiResult = await runInstatusAPI(config.statusApi)

  if (apiResult.success) {
    return {
      key:          'PAYSTACK',
      label:        ECOSYSTEM_PROBES.PAYSTACK.label,
      source:       'status_api',      // Real data — not inferred
      status:       apiResult.status,
      score:        apiResult.status === 'OPERATIONAL' ? 1.0 : apiResult.status === 'UNSTABLE' ? 0.7 : 0.3,
      incidents:    apiResult.incidents,
      maintenances: apiResult.maintenances,
      timestamp:    new Date().toISOString(),
      testDuration: `${Date.now() - start}ms`,
    }
  }

  // Fallback: HTTP probe if status API is unreachable
  const fallback = await runHTTPProbe('http_fallback', config.http_fallback)
  return {
    key:          'PAYSTACK',
    label:        ECOSYSTEM_PROBES.PAYSTACK.label,
    source:       'http_fallback',   // Status API was unreachable
    status:       fallback.success ? 'UNKNOWN' : 'LIKELY_OUTAGE',
    score:        fallback.success ? 0.5 : 0.1,
    note:         'Status API unreachable — using HTTP fallback probe',
    timestamp:    new Date().toISOString(),
    testDuration: `${Date.now() - start}ms`,
  }
}

async function _checkFlutterwave() {
  const start  = Date.now()
  const config = ECOSYSTEM_PROBES.FLUTTERWAVE

  const apiResult = await runAtlassianAPI(config.statusApi)

  if (apiResult.success) {
    return {
      key:          'FLUTTERWAVE',
      label:        ECOSYSTEM_PROBES.FLUTTERWAVE.label,
      source:       'status_api',
      status:       apiResult.status,
      score:        apiResult.status === 'OPERATIONAL' ? 1.0 : apiResult.status === 'UNSTABLE' ? 0.7 : 0.3,
      description:  apiResult.description,
      incidents:    apiResult.incidents,
      maintenances: apiResult.maintenances,
      timestamp:    new Date().toISOString(),
      testDuration: `${Date.now() - start}ms`,
    }
  }

  const fallback = await runHTTPProbe('http_fallback', config.http_fallback)
  return {
    key:          'FLUTTERWAVE',
    label:        ECOSYSTEM_PROBES.FLUTTERWAVE.label,
    source:       'http_fallback',
    status:       fallback.success ? 'UNKNOWN' : 'LIKELY_OUTAGE',
    score:        fallback.success ? 0.5 : 0.1,
    note:         'Status API unreachable — using HTTP fallback probe',
    timestamp:    new Date().toISOString(),
    testDuration: `${Date.now() - start}ms`,
  }
}

async function _checkInterswitch() {
  const start  = Date.now()
  const config = ECOSYSTEM_PROBES.INTERSWITCH
  const entries = Object.entries(config.probes)

  const settled = await Promise.allSettled(
    entries.map(([key, probe]) =>
      probe.type === 'http' ? runHTTPProbe(key, probe) : runDNSProbe(key, probe)
    )
  )

  const probeResults = {}
  settled.forEach((r, i) => {
    const [key] = entries[i]
    probeResults[key] = r.status === 'fulfilled' ? r.value : { success: false }
  })

  const { score, multiLayerFailure } = scoreProbeResults(probeResults, config.probes)

  return {
    key:          'INTERSWITCH',
    label:        config.label,
    description:  config.description,
    status:       resolveStatus(score, multiLayerFailure),
    score:        parseFloat(score.toFixed(3)),
    probeResults,
    // Interswitch context: if down, ATMs and POS are likely affected
    atmPosAffected: score < BANK_STATUS_THRESHOLDS.DEGRADED,
    timestamp:    new Date().toISOString(),
    testDuration: `${Date.now() - start}ms`,
  }
}

// ─────────────────────────────────────────────
// PUBLIC — getStatusMeta(status)
// ─────────────────────────────────────────────

export function getBankStatusMeta(status) {
  const map = {
    OPERATIONAL:      { label: 'Operational',     color: '#43A047', icon: '✅', severity: 0 },
    UNSTABLE:         { label: 'Unstable',         color: '#FFA726', icon: '⚠️',  severity: 1 },
    DEGRADED:         { label: 'Degraded',         color: '#EF6C00', icon: '🔶', severity: 2 },
    LIKELY_OUTAGE:    { label: 'Likely Outage',    color: '#E53935', icon: '🔴', severity: 3 },
    OUTAGE_CONFIRMED: { label: 'Outage',           color: '#B71C1C', icon: '🚨', severity: 4 },
    MAINTENANCE:      { label: 'Maintenance',      color: '#1565C0', icon: '🔧', severity: 0 },
    UNKNOWN:          { label: 'Unknown',          color: '#9E9E9E', icon: '❓', severity: -1 },
    CHECK_FAILED:     { label: 'Check Failed',     color: '#9E9E9E', icon: '❓', severity: -1 },
  }
  return map[status] || map['UNKNOWN']
}
