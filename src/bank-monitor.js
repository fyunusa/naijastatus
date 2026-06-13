/**
 * bank-monitor.js
 *
 * Manages the high-fidelity 8-phase bank checking engine, ecosystem financial backbone,
 * NIBSS transfer warning propagation, and dynamic dashboard card rendering.
 */

import { BankScheduler }     from './bank-scheduler.js'
import { getBankStatusMeta } from './bank-checker.js'
import { getAllServices }    from './statusEngine.js'

// ─── State ──────────────────────────────────────────────────────
const latestBankResults      = {}
const latestEcosystemResult  = {}
let   nibssTransfersAffected = false

// Supporting all 18 commercial banks and fintechs in banks.json
const bankKeysList = [
  'GTBANK', 'ZENITH', 'ACCESS', 'FIRSTBANK', 'UBA', 'UNION',
  'STERLING', 'WEMA', 'FIDELITY', 'FCMB', 'STANBIC', 'OPAY',
  'PALMPAY', 'KUDA', 'MONIEPOINT', 'CARBON', 'FAIRMONEY', 'PROVIDUS'
]

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Maps the bank status string to standard CSS classes
 */
function getUIStatusClass(status) {
  switch (status) {
    case 'OPERATIONAL':
      return 'operational';
    case 'UNSTABLE':
    case 'DEGRADED':
    case 'MAINTENANCE':
    case 'UNKNOWN':
    case 'CHECK_FAILED':
      return 'degraded';
    case 'LIKELY_OUTAGE':
    case 'OUTAGE_CONFIRMED':
      return 'outage';
    default:
      return 'degraded';
  }
}

// ─── Bank Card Update ───────────────────────────────────────────

function updateBankCard(bankKey, result) {
  latestBankResults[bankKey] = result
  const meta = getBankStatusMeta(result.status)
  const uiStatus = getUIStatusClass(result.status)

  // Find the dynamically rendered card in the DOM
  const card = document.querySelector(`[data-bank="${bankKey}"]`)
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

  // 3. Latency Value (average of successful probes)
  const latencyVal = card.querySelectorAll('.card-stat-value')[1]
  if (latencyVal) {
    const successful = Object.values(result.probeResults || {}).filter(p => p.success && p.latency)
    const avgLatency = successful.length > 0
      ? Math.round(successful.reduce((s, p) => s + p.latency, 0) / successful.length)
      : null
    latencyVal.textContent = result.status === 'NO_INTERNET' || result.status === 'DEVICE_OFFLINE' || !avgLatency
      ? '—' 
      : `${avgLatency}ms`
  }

  // 4. Status Badge
  const badge = card.querySelector('.card-status-badge')
  if (badge) {
    badge.className = `card-status-badge ${uiStatus}`
    badge.innerHTML = `<span class="badge-dot"></span> ${meta.label}`
  }

  // 5. Last Checked Timestamp
  const timeEl = card.querySelector('.card-last-checked')
  if (timeEl) {
    timeEl.textContent = `Last checked: ${new Date(result.timestamp).toLocaleTimeString()}`
  }

  // 6. NIBSS Warning Banner (NIBSS issue affects all banks)
  const nibssWarning = card.querySelector('.nibss-warning')
  if (nibssWarning) {
    if (nibssTransfersAffected) {
      nibssWarning.style.display = 'block'
      nibssWarning.textContent = '⚠️ Interbank transfers may be affected (NIBSS issue)'
    } else {
      nibssWarning.style.display = 'none'
    }
  }

  // Debug log during dev
  if (import.meta.env?.DEV) {
    console.log(`[NaijaStatus] Bank Check: ${bankKey}`, result)
  }
}

// ─── Ecosystem Panel Update ─────────────────────────────────────

function updateEcosystemPanel(ecoResult) {
  Object.assign(latestEcosystemResult, ecoResult)

  // Update NIBSS global flag (propagates warning to all bank cards)
  nibssTransfersAffected = ecoResult.NIBSS?.transfersAffected || false

  // If NIBSS is affected, re-render all bank cards to show warning banner
  if (nibssTransfersAffected) {
    for (const key of Object.keys(latestBankResults)) {
      updateBankCard(key, latestBankResults[key])
    }
  }

  // Update each ecosystem panel in the DOM
  for (const [ecoKey, result] of Object.entries(ecoResult)) {
    if (!result?.status) continue
    const panel = document.querySelector(`[data-eco="${ecoKey}"]`)
    if (!panel) continue

    const meta = getBankStatusMeta(result.status)
    const uiStatus = getUIStatusClass(result.status)

    // 1. Panel Border styling
    panel.style.borderColor = meta.color

    // 2. Status text
    const statusEl = panel.querySelector('.eco-status')
    if (statusEl) {
      statusEl.textContent = `${meta.icon} ${meta.label}`
      statusEl.style.color = meta.color
    }

    // 3. Incidents display (Paystack / Flutterwave)
    const incidentsEl = panel.querySelector('.eco-incidents')
    if (incidentsEl) {
      if (result.incidents && result.incidents.length > 0) {
        incidentsEl.innerHTML = result.incidents
          .map(i => `<div style="padding: 4px 0; border-top: 1px dashed var(--border); margin-top: 4px;">🔴 ${i.name}${i.url ? ` — <a href="${i.url}" target="_blank" style="text-decoration: underline; color: var(--status-red); font-weight: 700;">details</a>` : ''}</div>`)
          .join('')
        incidentsEl.style.display = 'block'
      } else {
        incidentsEl.style.display = 'none'
      }
    }

    // 4. Source badge
    const sourceEl = panel.querySelector('.eco-source')
    if (sourceEl) {
      sourceEl.textContent = result.source === 'status_api' ? '🟢 Live API' : '🟡 HTTP probe'
    }
  }

  // Emit event for other parts of the app
  window.dispatchEvent(new CustomEvent('ecosystem-status-update', { detail: ecoResult }))
}

// ─── Scheduler ──────────────────────────────────────────────────

const scheduler = new BankScheduler({
  banks: bankKeysList,

  onBankResult(bankKey, result) {
    latestBankResults[bankKey] = result

    // 1. Sync state to the central services array in statusEngine.js
    const services = getAllServices()
    const service = services.find(s => s.id === bankKey.toLowerCase())
    if (service) {
      const uiStatus = getUIStatusClass(result.status)
      service.status = uiStatus
      service.successRate = Math.round(result.score * 100)
      
      const successful = Object.values(result.probeResults || {}).filter(p => p.success && p.latency)
      const avgLatency = successful.length > 0
        ? Math.round(successful.reduce((s, p) => s + p.latency, 0) / successful.length)
        : 0
      service.latency = avgLatency
      
      // Update sector status details dynamically
      service.sectors = service.sectors.map(sec => {
        let secStatus = uiStatus
        let secDetail = 'Operational'
        
        const nameLower = sec.name.toLowerCase()
        if (nameLower.includes('inflow') || nameLower.includes('receiving')) {
          if (nibssTransfersAffected) {
            secStatus = 'outage'
            secDetail = 'Interbank transfers affected (NIBSS issue)'
          } else {
            secStatus = uiStatus
            secDetail = uiStatus === 'operational' ? 'Instant settlement active' : 'Gateway delays reported'
          }
        } else if (nameLower.includes('outflow') || nameLower.includes('sending')) {
          if (nibssTransfersAffected) {
            secStatus = 'outage'
            secDetail = 'Interbank transfers affected (NIBSS issue)'
          } else {
            secStatus = uiStatus
            secDetail = uiStatus === 'operational' ? 'NIP channels active' : 'Transfers delayed'
          }
        } else if (nameLower.includes('app') || nameLower.includes('wallet')) {
          secStatus = uiStatus
          secDetail = uiStatus === 'operational' ? 'Stable login times' : 'Server response delay'
        } else if (nameLower.includes('ussd')) {
          secStatus = uiStatus
          secDetail = uiStatus === 'operational' ? 'Stable connection' : 'USSD response delay'
        }
        return { ...sec, status: secStatus, detail: secDetail }
      })
    }

    // 2. Render card changes in UI
    updateBankCard(bankKey, result)

    // 3. Dispatch unified status update
    window.dispatchEvent(new CustomEvent('statusUpdate', { detail: { services } }))
  },

  onEcosystemResult(ecoResult) {
    updateEcosystemPanel(ecoResult)

    // Sync gateway details (Paystack / Flutterwave) back to central services list if present
    const services = getAllServices()
    const paystack = services.find(s => s.id === 'paystack')
    if (paystack && ecoResult.PAYSTACK) {
      paystack.status = getUIStatusClass(ecoResult.PAYSTACK.status)
      paystack.successRate = Math.round(ecoResult.PAYSTACK.score * 100)
    }
    const flutterwave = services.find(s => s.id === 'flutterwave')
    if (flutterwave && ecoResult.FLUTTERWAVE) {
      flutterwave.status = getUIStatusClass(ecoResult.FLUTTERWAVE.status)
      flutterwave.successRate = Math.round(ecoResult.FLUTTERWAVE.score * 100)
    }

    // Dispatch unified status update
    window.dispatchEvent(new CustomEvent('statusUpdate', { detail: { services } }))
  },

  onError(key, err) {
    console.warn(`[NaijaStatus Banks] Error for ${key}:`, err)
  },
})

// ─── Bootstrap ──────────────────────────────────────────────────

export function initBankMonitor() {
  scheduler.start()

  // Re-check when tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      for (const key of Object.keys(latestBankResults)) {
        scheduler.checkBankNow(key)
      }
      scheduler.checkEcosystemNow()
    }
  })
}

export function forceBankRecheck(bankKey) {
  if (bankKey) {
    scheduler.checkBankNow(bankKey)
  } else {
    for (const key of Object.keys(latestBankResults)) {
      scheduler.checkBankNow(key)
    }
    scheduler.checkEcosystemNow()
  }
}

export function getLatestBankResult(bankKey)  { return latestBankResults[bankKey] }
export function getLatestEcosystem()          { return latestEcosystemResult }
export function isNIBSSAffected()             { return nibssTransfersAffected }
