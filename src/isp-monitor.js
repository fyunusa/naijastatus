/**
 * isp-monitor.js
 * 
 * Manages the high-fidelity 8-phase ISP checking engine, decay history scoring, 
 * and adaptive cadence scheduler. Synchronizes ISP statuses with the central status 
 * engine and the dynamic dashboard card rendering.
 */

import { ISPScheduler }  from './isp-scheduler.js'
import { DecayScorer }   from './isp-decay-scorer.js'
import { getStatusMeta } from './isp-checker.js'
import { getAllServices } from './statusEngine.js'

// ─── State ──────────────────────────────────────────────────────

const decayScorer = new DecayScorer()

// Store latest result per ISP for UI rendering (supports all 10 ISPs)
const latestResults = {
  MTN:        null,
  AIRTEL:     null,
  GLO:        null,
  '9MOBILE':  null,
  STARLINK:   null,
  SPECTRANET: null,
  IPNX:       null,
  SMILE:      null,
  FIBERONE:   null,
  TIZETI:     null,
}

// ─── Helpers ────────────────────────────────────────────────────

function getUserZone() {
  return localStorage.getItem('naijastatus_zone') || 'unknown'
}

/**
 * Maps the 8-phase checker status to the 3 main CSS states of NaijaStatus
 */
function getUIStatusClass(status) {
  switch (status) {
    case 'OPERATIONAL':
      return 'operational';
    case 'UNSTABLE':
    case 'DEGRADED':
    case 'DEVICE_OFFLINE':
    case 'NO_INTERNET':
      return 'degraded';
    case 'LIKELY_OUTAGE':
    case 'OUTAGE_CONFIRMED':
      return 'outage';
    default:
      return 'degraded';
  }
}

// ─── UI Update ──────────────────────────────────────────────────

function updateISPCard(ispKey, result) {
  const meta = getStatusMeta(result.status)
  const uiStatus = getUIStatusClass(result.status)

  // Find the dynamically rendered card in the DOM
  const card = document.querySelector(`[data-isp="${ispKey}"]`)
  if (!card) return

  // 1. Status Ring
  const ring = card.querySelector('.status-ring')
  if (ring) {
    ring.className = `status-ring ${uiStatus}`
  }

  // 2. Success Rate
  const successVal = card.querySelector('.card-stat-value')
  if (successVal) {
    successVal.textContent = `${Math.round(result.score * 100)}%`
    successVal.className = `card-stat-value ${uiStatus}`
  }

  // 3. Latency Value
  const latencyVal = card.querySelectorAll('.card-stat-value')[1]
  if (latencyVal) {
    latencyVal.textContent = result.status === 'NO_INTERNET' || result.status === 'DEVICE_OFFLINE' ? '—' : `${Math.round(result.avgISPLatency || 0)}ms`
  }

  // 4. Status Badge
  const badge = card.querySelector('.card-status-badge')
  if (badge) {
    badge.className = `card-status-badge ${uiStatus}`
    badge.innerHTML = `<span class="badge-dot"></span> ${meta.label}`
  }

  // 5. Decay-weighted Trend
  decayScorer.record(ispKey, result.score)
  const trend = decayScorer.getTrend(ispKey)

  const trendEl = card.querySelector('.card-trend-info')
  if (trendEl) {
    const trendMap = {
      WORSENING: '📉 Worsening',
      IMPROVING: '📈 Improving',
      STABLE:    '➡️ Stable',
    }
    trendEl.textContent = trendMap[trend] || '➡️ Stable'
  }

  // 6. Last Checked Timestamp
  const timeEl = card.querySelector('.card-last-checked')
  if (timeEl) {
    timeEl.textContent = `Last checked: ${new Date(result.timestamp).toLocaleTimeString()}`
  }

  // Debug: log full result to console during dev
  if (import.meta.env?.DEV) {
    console.log(`[NaijaStatus] ISP Check: ${ispKey}`, result)
  }
}

// ─── Scheduler Setup ────────────────────────────────────────────

const scheduler = new ISPScheduler({
  zone: getUserZone(),
  isps: Object.keys(latestResults),

  onResult(ispKey, result) {
    latestResults[ispKey] = result

    // 1. Sync state to the central services array in statusEngine.js
    const services = getAllServices()
    const service = services.find(s => s.id === ispKey.toLowerCase())
    if (service) {
      const uiStatus = getUIStatusClass(result.status)
      service.status = uiStatus
      service.successRate = Math.round(result.score * 100)
      service.latency = result.avgISPLatency ? Math.round(result.avgISPLatency) : 0
      
      // Update sector status details dynamically
      service.sectors = service.sectors.map(sec => {
        let secStatus = uiStatus
        let secDetail = 'Operational'
        if (uiStatus === 'outage') {
          secStatus = 'outage'
          secDetail = 'Connection failed'
        } else if (uiStatus === 'degraded') {
          secStatus = 'degraded'
          secDetail = 'Elevated response time'
        } else {
          secStatus = 'operational'
          secDetail = 'Normal operations'
        }
        return { ...sec, status: secStatus, detail: secDetail }
      })
    }

    // 2. Render changes on card
    updateISPCard(ispKey, result)

    // 3. Dispatch global update to refresh overall health stats and 3D globe connections
    window.dispatchEvent(new CustomEvent('statusUpdate', {
      detail: { services }
    }))
  },

  onError(ispKey, err) {
    console.warn(`[NaijaStatus] Probe error for ${ispKey}:`, err)
  },
})

// ─── Bootstrap ──────────────────────────────────────────────────

export function initISPMonitor() {
  scheduler.start()

  // If the user comes back from a background tab, re-run checks
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      for (const key of Object.keys(latestResults)) {
        scheduler.checkNow(key)
      }
    }
  })
}

// Manual re-check button handler
export function forceRecheck(ispKey) {
  if (ispKey) {
    scheduler.checkNow(ispKey)
  } else {
    // recheck all
    for (const key of Object.keys(latestResults)) {
      scheduler.checkNow(key)
    }
  }
}

// Get the latest result for programmatic use
export function getLatestResult(ispKey) {
  return latestResults[ispKey]
}
