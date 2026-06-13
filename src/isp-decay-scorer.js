/**
 * isp-decay-scorer.js
 * 
 * Exponential decay history scorer.
 * Keeps a rolling history of probe results per ISP.
 * Recent results count more than older ones.
 * 
 * This prevents a single fluke from spiking the status — 
 * and detects real outages fast when multiple failures cluster.
 * 
 * Usage:
 *   import { DecayScorer } from './isp-decay-scorer.js'
 * 
 *   const scorer = new DecayScorer()
 * 
 *   // Feed in a new probe result
 *   scorer.record('MTN', 0.9)     // score 0.9 = good probe
 *   scorer.record('MTN', 0.1)     // score 0.1 = bad probe (outage?)
 * 
 *   // Get the current decay-weighted score
 *   scorer.getScore('MTN')        // e.g. 0.61 (weighted toward recent bad result)
 *   scorer.getTrend('MTN')        // 'WORSENING' | 'IMPROVING' | 'STABLE'
 */

// Score loses half its weight every HALF_LIFE_MS milliseconds
const HALF_LIFE_MS = 2 * 60 * 1000  // 2 minutes

// Max history entries to store per ISP (prevents unbounded memory)
const MAX_HISTORY = 50

export class DecayScorer {
  #history = {}   // { ISP_KEY: [{ score, timestamp }] }

  // Record a new probe score for an ISP
  record(ispKey, score) {
    if (!this.#history[ispKey]) this.#history[ispKey] = []

    this.#history[ispKey].push({ score, timestamp: Date.now() })

    // Trim oldest entries beyond max
    if (this.#history[ispKey].length > MAX_HISTORY) {
      this.#history[ispKey].shift()
    }
  }

  // Get the current decay-weighted score (0.0 – 1.0)
  getScore(ispKey) {
    const history = this.#history[ispKey]
    if (!history || history.length === 0) return null

    const now = Date.now()
    let weightedSum  = 0
    let totalWeight  = 0

    for (const entry of history) {
      const ageMs       = now - entry.timestamp
      const decayFactor = Math.pow(0.5, ageMs / HALF_LIFE_MS)
      weightedSum  += entry.score * decayFactor
      totalWeight  += decayFactor
    }

    return totalWeight > 0
      ? parseFloat((weightedSum / totalWeight).toFixed(3))
      : null
  }

  // Get trend: is the ISP getting worse, better, or stable?
  getTrend(ispKey) {
    const history = this.#history[ispKey]
    if (!history || history.length < 3) return 'STABLE'

    // Compare last 3 scores
    const recent = history.slice(-3).map(e => e.score)
    const avg    = arr => arr.reduce((s, v) => s + v, 0) / arr.length

    const early  = avg(recent.slice(0, 2))
    const latest = recent[recent.length - 1]
    const delta  = latest - early

    if (delta < -0.15) return 'WORSENING'
    if (delta >  0.15) return 'IMPROVING'
    return 'STABLE'
  }

  // Get full history for an ISP
  getHistory(ispKey) {
    return this.#history[ispKey] || []
  }

  // Clear history for an ISP (or all)
  clear(ispKey) {
    if (ispKey) delete this.#history[ispKey]
    else        this.#history = {}
  }
}
