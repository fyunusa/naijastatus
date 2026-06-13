# NaijaStatus — ISP Checker Module

Drop these 4 files into your `src/` folder.

## Files

| File | Purpose |
|------|---------|
| `isp-probes.config.js` | Probe targets for MTN, Airtel, Glo, 9mobile. Edit weights here. |
| `isp-checker.js` | Core engine. Runs all 8 phases and returns a result object. |
| `isp-scheduler.js` | Adaptive polling. Checks every 5s during outage, 60s when stable. |
| `isp-decay-scorer.js` | Rolling history with exponential decay. Smooths out false positives. |
| `isp-integration-example.js` | Reference wiring — adapt to your main.js. |

## Quick Start

```js
// In your main.js
import { initISPMonitor } from './isp-integration-example.js'

document.addEventListener('DOMContentLoaded', () => {
  initISPMonitor()
})
```

Your ISP cards in HTML need `data-isp` attributes:

```html
<div class="isp-card" data-isp="MTN">
  <span class="status-badge"></span>
  <span class="status-trend"></span>
  <span class="last-checked"></span>
  <span class="latency-info"></span>
</div>
```

## Result Object

```js
{
  isp: 'MTN',
  label: 'MTN Nigeria',
  status: 'OPERATIONAL',        // see statuses below
  score: 0.94,                  // 0.0 – 1.0
  latencyRatio: 1.3,            // ISP latency vs neutral baseline
  corroboration: {
    httpFailed: false,
    dnsFailed: false,
    multiLayerFailure: false,
  },
  probeResults: { ... },        // individual probe breakdown
  deviceSignal: {
    effectiveType: '4g',
    downlink: 8.5,
    rtt: 120
  },
  zone: 'Kano Municipal',
  timestamp: '2026-06-12T21:00:00.000Z',
  testDuration: '1842ms'
}
```

## Statuses

| Status | Meaning |
|--------|---------|
| `OPERATIONAL` | score ≥ 0.85 — all good |
| `UNSTABLE` | score 0.60–0.84 — minor issues |
| `DEGRADED` | score 0.30–0.59, single-layer failure |
| `LIKELY_OUTAGE` | score 0.30–0.59, HTTP + DNS both failing |
| `OUTAGE_CONFIRMED` | score < 0.30, HTTP + DNS both failing |
| `NO_INTERNET` | user's own connection is down |
| `DEVICE_OFFLINE` | `navigator.onLine` returned false |

## No Backend Required

All probes run from the browser using:
- Standard `fetch()` for HTTP probes
- DNS-over-HTTPS (DoH) for DNS probes — these are just HTTPS requests to
  `cloudflare-dns.com` and `dns.google`, no special permissions needed

No Cloudflare Worker needed unless you want to add server-side probing later.
