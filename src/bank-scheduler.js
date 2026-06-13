/**
 * bank-scheduler.js
 *
 * Adaptive polling scheduler for banks + ecosystem.
 * Same cadence logic as isp-scheduler.js — polls faster during issues.
 *
 * Usage:
 *   import { BankScheduler } from './bank-scheduler.js'
 *
 *   const scheduler = new BankScheduler({
 *     onBankResult: (bankKey, result) => updateUI(bankKey, result),
 *     onEcosystemResult: (result) => updateEcosystemUI(result),
 *     onError: (key, err) => console.error(key, err),
 *   })
 *
 *   scheduler.start()
 *   scheduler.stop()
 *   scheduler.checkBankNow('GTBANK')
 *   scheduler.checkEcosystemNow()
 */

import { runBankCheck, runAllBankChecks, runEcosystemCheck } from './bank-checker.js'

const CADENCE = {
  STABLE:   120_000,  // 2 min — banks change state slowly vs ISPs
  WATCHFUL:  30_000,  // 30s — something's off
  CRITICAL:  10_000,  // 10s — confirm outage
}

// Ecosystem (NIBSS, Paystack etc) checked less frequently — real APIs are reliable
const ECOSYSTEM_CADENCE = {
  STABLE:   180_000,  // 3 min
  WATCHFUL:  60_000,  // 1 min
  CRITICAL:  15_000,  // 15s
}

function getCadence(score, isEcosystem = false) {
  const table = isEcosystem ? ECOSYSTEM_CADENCE : CADENCE
  if (score >= 0.85) return table.STABLE
  if (score >= 0.60) return table.WATCHFUL
  return table.CRITICAL
}

export class BankScheduler {
  #bankTimers      = {}
  #ecosystemTimer  = null
  #bankScores      = {}
  #ecosystemScore  = 1.0
  #running         = false
  #options         = {}

  constructor(options = {}) {
    this.#options = {
      banks:             options.banks             || Object.keys((async () => {
        const { BANK_PROBES } = await import('./bank-probes.config.js')
        return BANK_PROBES
      })()),
      onBankResult:      options.onBankResult      || (() => {}),
      onEcosystemResult: options.onEcosystemResult || (() => {}),
      onError:           options.onError           || console.error,
    }
  }

  async start() {
    if (this.#running) return
    this.#running = true

    // Import bank keys at runtime
    const { BANK_PROBES } = await import('./bank-probes.config.js')
    this.#options.banks = Object.keys(BANK_PROBES)

    // Run initial full check concurrently
    try {
      const [bankResults, ecoResult] = await Promise.allSettled([
        runAllBankChecks(),
        runEcosystemCheck(),
      ])

      if (bankResults.status === 'fulfilled') {
        for (const [key, result] of Object.entries(bankResults.value)) {
          this.#bankScores[key] = result.score || 0
          this.#options.onBankResult(key, result)
          this.#scheduleBankNext(key)
        }
      }

      if (ecoResult.status === 'fulfilled') {
        this.#ecosystemScore = this._calcEcosystemScore(ecoResult.value)
        this.#options.onEcosystemResult(ecoResult.value)
        this.#scheduleEcosystemNext()
      }

    } catch (err) {
      this.#options.onError('INIT', err)
      // Schedule individually as fallback
      for (const key of this.#options.banks) {
        this.#scheduleBankNext(key)
      }
      this.#scheduleEcosystemNext()
    }
  }

  stop() {
    this.#running = false
    for (const id of Object.values(this.#bankTimers)) clearTimeout(id)
    if (this.#ecosystemTimer) clearTimeout(this.#ecosystemTimer)
    this.#bankTimers    = {}
    this.#ecosystemTimer = null
  }

  async checkBankNow(bankKey) {
    clearTimeout(this.#bankTimers[bankKey])
    await this.#runBankCheck(bankKey)
  }

  async checkEcosystemNow() {
    clearTimeout(this.#ecosystemTimer)
    await this.#runEcosystemCheck()
  }

  getLastBankScore(bankKey)  { return this.#bankScores[bankKey] ?? null }
  getEcosystemScore()        { return this.#ecosystemScore }

  // Private
  async #runBankCheck(bankKey) {
    if (!this.#running) return
    try {
      const result = await runBankCheck(bankKey)
      this.#bankScores[bankKey] = result.score ?? 0
      this.#options.onBankResult(bankKey, result)
    } catch (err) {
      this.#options.onError(bankKey, err)
    } finally {
      this.#scheduleBankNext(bankKey)
    }
  }

  async #runEcosystemCheck() {
    if (!this.#running) return
    try {
      const result = await runEcosystemCheck()
      this.#ecosystemScore = this._calcEcosystemScore(result)
      this.#options.onEcosystemResult(result)
    } catch (err) {
      this.#options.onError('ECOSYSTEM', err)
    } finally {
      this.#scheduleEcosystemNext()
    }
  }

  #scheduleBankNext(bankKey) {
    if (!this.#running) return
    const interval = getCadence(this.#bankScores[bankKey] ?? 1.0, false)
    this.#bankTimers[bankKey] = setTimeout(() => this.#runBankCheck(bankKey), interval)
  }

  #scheduleEcosystemNext() {
    if (!this.#running) return
    const interval = getCadence(this.#ecosystemScore, true)
    this.#ecosystemTimer = setTimeout(() => this.#runEcosystemCheck(), interval)
  }

  // Derive a single score from ecosystem results for cadence decisions
  _calcEcosystemScore(ecoResult) {
    const scores = ['NIBSS', 'PAYSTACK', 'FLUTTERWAVE', 'INTERSWITCH']
      .map(k => ecoResult[k]?.score ?? 1.0)
    return scores.reduce((s, v) => s + v, 0) / scores.length
  }
}
