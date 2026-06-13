/**
 * isp-scheduler.js
 * 
 * Adaptive cadence scheduler.
 * Polls faster when an ISP is in trouble, slower when stable.
 * 
 * Usage:
 *   import { ISPScheduler } from './isp-scheduler.js'
 * 
 *   const scheduler = new ISPScheduler({
 *     zone: 'Kano Municipal',
 *     onResult: (ispKey, result) => {
 *       console.log(`${ispKey}: ${result.status} (${result.score})`)
 *       updateYourUI(ispKey, result)
 *     },
 *     onError: (ispKey, err) => console.error(ispKey, err)
 *   })
 * 
 *   scheduler.start()   // begins polling all ISPs
 *   scheduler.stop()    // stops everything
 *   scheduler.checkNow('MTN')  // force an immediate check
 */

import { runISPCheck, runAllISPChecks } from './isp-checker.js'

// Polling intervals in milliseconds, based on current score
const CADENCE = {
  STABLE:    60_000,  // score ≥ 0.85 → every 60s
  WATCHFUL:  20_000,  // score 0.60–0.84 → every 20s
  CRITICAL:   5_000,  // score < 0.60 → every 5s
}

function getCadence(score) {
  if (score >= 0.85) return CADENCE.STABLE
  if (score >= 0.60) return CADENCE.WATCHFUL
  return CADENCE.CRITICAL
}

export class ISPScheduler {
  #timers    = {}     // { ISP_KEY: timeoutId }
  #scores    = {}     // { ISP_KEY: lastScore }
  #running   = false
  #options   = {}

  constructor(options = {}) {
    this.#options = {
      zone:     options.zone     || 'unknown',
      onResult: options.onResult || (() => {}),
      onError:  options.onError  || console.error,
      isps:     options.isps     || ['MTN', 'AIRTEL', 'GLO', '9MOBILE'],
    }
  }

  // Start polling all configured ISPs
  async start() {
    if (this.#running) return
    this.#running = true

    // Run an initial check for all ISPs immediately (concurrent)
    try {
      const initial = await runAllISPChecks({ zone: this.#options.zone })
      for (const [key, result] of Object.entries(initial)) {
        this.#scores[key] = result.score || 0
        this.#options.onResult(key, result)
        // Schedule next check based on initial result
        this.#scheduleNext(key)
      }
    } catch (err) {
      this.#options.onError('ALL', err)
      // Fall back to scheduling each individually
      for (const key of this.#options.isps) {
        this.#scheduleNext(key)
      }
    }
  }

  // Stop all polling
  stop() {
    this.#running = false
    for (const id of Object.values(this.#timers)) {
      clearTimeout(id)
    }
    this.#timers = {}
  }

  // Force an immediate check for a specific ISP (resets its timer)
  async checkNow(ispKey) {
    clearTimeout(this.#timers[ispKey])
    await this.#runCheck(ispKey)
  }

  // Get the last known score for an ISP
  getLastScore(ispKey) {
    return this.#scores[ispKey] ?? null
  }

  // Private: run a single check and reschedule
  async #runCheck(ispKey) {
    if (!this.#running) return

    try {
      const result = await runISPCheck(ispKey, { zone: this.#options.zone })
      this.#scores[ispKey] = result.score ?? 0
      this.#options.onResult(ispKey, result)
    } catch (err) {
      this.#options.onError(ispKey, err)
    } finally {
      this.#scheduleNext(ispKey)
    }
  }

  // Private: schedule next check based on current score
  #scheduleNext(ispKey) {
    if (!this.#running) return
    const interval = getCadence(this.#scores[ispKey] ?? 1.0)
    this.#timers[ispKey] = setTimeout(() => this.#runCheck(ispKey), interval)
  }
}
