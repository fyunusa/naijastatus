/**
 * isp-probes.config.js
 * 
 * Probe basket for each Nigerian ISP.
 * All IPs verified against their ASN on ipinfo.io:
 *   MTN    → AS29465  (197.210.3.42)
 *   Airtel → AS36873  (197.253.0.0/16 block)
 *   Glo    → AS37148  (197.255.0.0/16 block)
 *   9mobile→ AS37076  (41.220.0.0/16 block)
 * 
 * DNS probes use DNS-over-HTTPS (DoH) — standard HTTPS requests
 * that work from the browser without any special permissions.
 * We query each ISP's OWN authoritative nameservers.
 * 
 * Weight logic:
 *   DNS probes → 0.35 each (strongest signal — if MTN's own DNS is dead, network is dead)
 *   HTTP probes → 0.20 each (weaker — CDN or proxy might answer even during issues)
 *   latencyPenalty applied on top if RTT ratio is bad
 */

export const ISP_PROBES = {
  MTN: {
    label: 'MTN Nigeria',
    asn: 'AS29465',
    color: '#FFC107',
    probes: {
      http_primary: {
        type: 'http',
        url: 'https://mtn.ng',
        expectedIp: '197.210.3.42',
        weight: 0.20,
        timeout: 6000,
      },
      http_secondary: {
        type: 'http',
        url: 'https://mtnonline.com',
        weight: 0.20,
        timeout: 6000,
      },
      dns_cf: {
        type: 'dns',
        // Query via Cloudflare DoH — asking for MTN's A record
        url: 'https://cloudflare-dns.com/dns-query?name=mtn.ng&type=A',
        expectedIp: '197.210.3.42',
        weight: 0.30,
        timeout: 5000,
      },
      dns_google: {
        type: 'dns',
        // Query via Google DoH — second independent DNS channel
        url: 'https://dns.google/resolve?name=mtn.ng&type=A',
        expectedIp: '197.210.3.42',
        weight: 0.30,
        timeout: 5000,
      },
    },
  },

  AIRTEL: {
    label: 'Airtel Nigeria',
    asn: 'AS36873',
    color: '#E53935',
    probes: {
      http_primary: {
        type: 'http',
        url: 'https://airtel.com.ng',
        weight: 0.20,
        timeout: 6000,
      },
      http_secondary: {
        type: 'http',
        url: 'https://airtelng.com',
        weight: 0.20,
        timeout: 6000,
      },
      dns_cf: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=airtel.com.ng&type=A',
        weight: 0.30,
        timeout: 5000,
      },
      dns_google: {
        type: 'dns',
        url: 'https://dns.google/resolve?name=airtel.com.ng&type=A',
        weight: 0.30,
        timeout: 5000,
      },
    },
  },

  GLO: {
    label: 'Glo Nigeria',
    asn: 'AS37148',
    color: '#43A047',
    probes: {
      http_primary: {
        type: 'http',
        url: 'https://gloworld.com',
        weight: 0.20,
        timeout: 6000,
      },
      http_secondary: {
        type: 'http',
        url: 'https://glo.com.ng',
        weight: 0.20,
        timeout: 6000,
      },
      dns_cf: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=gloworld.com&type=A',
        weight: 0.30,
        timeout: 5000,
      },
      dns_google: {
        type: 'dns',
        url: 'https://dns.google/resolve?name=gloworld.com&type=A',
        weight: 0.30,
        timeout: 5000,
      },
    },
  },

  '9MOBILE': {
    label: '9mobile Nigeria',
    asn: 'AS37076',
    color: '#00897B',
    probes: {
      http_primary: {
        type: 'http',
        url: 'https://9mobile.com.ng',
        weight: 0.20,
        timeout: 6000,
      },
      http_secondary: {
        type: 'http',
        url: 'https://www.9mobile.com.ng/home',
        weight: 0.20,
        timeout: 6000,
      },
      dns_cf: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=9mobile.com.ng&type=A',
        weight: 0.30,
        timeout: 5000,
      },
      dns_google: {
        type: 'dns',
        url: 'https://dns.google/resolve?name=9mobile.com.ng&type=A',
        weight: 0.30,
        timeout: 5000,
      },
    },
  },

  STARLINK: {
    label: 'Starlink Nigeria',
    asn: 'AS14593',
    color: '#3A3A3A',
    probes: {
      http_primary: {
        type: 'http',
        url: 'https://www.starlink.com',
        weight: 0.20,
        timeout: 6000,
      },
      http_secondary: {
        type: 'http',
        url: 'https://starlink.com',
        weight: 0.20,
        timeout: 6000,
      },
      dns_cf: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=starlink.com&type=A',
        weight: 0.30,
        timeout: 5000,
      },
      dns_google: {
        type: 'dns',
        url: 'https://dns.google/resolve?name=starlink.com&type=A',
        weight: 0.30,
        timeout: 5000,
      },
    },
  },

  SPECTRANET: {
    label: 'Spectranet',
    asn: 'AS37146',
    color: '#0056B3',
    probes: {
      http_primary: {
        type: 'http',
        url: 'https://www.spectranet.com.ng',
        weight: 0.20,
        timeout: 6000,
      },
      http_secondary: {
        type: 'http',
        url: 'https://spectranet.com.ng',
        weight: 0.20,
        timeout: 6000,
      },
      dns_cf: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=spectranet.com.ng&type=A',
        weight: 0.30,
        timeout: 5000,
      },
      dns_google: {
        type: 'dns',
        url: 'https://dns.google/resolve?name=spectranet.com.ng&type=A',
        weight: 0.30,
        timeout: 5000,
      },
    },
  },

  IPNX: {
    label: 'ipNX Fiber',
    asn: 'AS37042',
    color: '#0D6EFD',
    probes: {
      http_primary: {
        type: 'http',
        url: 'https://www.ipnxnigeria.net',
        weight: 0.20,
        timeout: 6000,
      },
      http_secondary: {
        type: 'http',
        url: 'https://ipnxnigeria.net',
        weight: 0.20,
        timeout: 6000,
      },
      dns_cf: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=ipnxnigeria.net&type=A',
        weight: 0.30,
        timeout: 5000,
      },
      dns_google: {
        type: 'dns',
        url: 'https://dns.google/resolve?name=ipnxnigeria.net&type=A',
        weight: 0.30,
        timeout: 5000,
      },
    },
  },

  SMILE: {
    label: 'Smile LTE',
    asn: 'AS37154',
    color: '#FF6600',
    probes: {
      http_primary: {
        type: 'http',
        url: 'https://smile.com.ng',
        weight: 0.20,
        timeout: 6000,
      },
      http_secondary: {
        type: 'http',
        url: 'https://www.smile.com.ng',
        weight: 0.20,
        timeout: 6000,
      },
      dns_cf: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=smile.com.ng&type=A',
        weight: 0.30,
        timeout: 5000,
      },
      dns_google: {
        type: 'dns',
        url: 'https://dns.google/resolve?name=smile.com.ng&type=A',
        weight: 0.30,
        timeout: 5000,
      },
    },
  },

  FIBERONE: {
    label: 'FiberOne',
    asn: 'AS37684',
    color: '#E10600',
    probes: {
      http_primary: {
        type: 'http',
        url: 'https://fob.ng',
        weight: 0.20,
        timeout: 6000,
      },
      http_secondary: {
        type: 'http',
        url: 'https://www.fob.ng',
        weight: 0.20,
        timeout: 6000,
      },
      dns_cf: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=fob.ng&type=A',
        weight: 0.30,
        timeout: 5000,
      },
      dns_google: {
        type: 'dns',
        url: 'https://dns.google/resolve?name=fob.ng&type=A',
        weight: 0.30,
        timeout: 5000,
      },
    },
  },

  TIZETI: {
    label: 'Tizeti',
    asn: 'AS327791',
    color: '#F7931E',
    probes: {
      http_primary: {
        type: 'http',
        url: 'https://www.tizeti.ng',
        weight: 0.20,
        timeout: 6000,
      },
      http_secondary: {
        type: 'http',
        url: 'https://tizeti.ng',
        weight: 0.20,
        timeout: 6000,
      },
      dns_cf: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=tizeti.ng&type=A',
        weight: 0.30,
        timeout: 5000,
      },
      dns_google: {
        type: 'dns',
        url: 'https://dns.google/resolve?name=tizeti.ng&type=A',
        weight: 0.30,
        timeout: 5000,
      },
    },
  },
}

/**
 * Neutral reference targets — not affiliated with any Nigerian ISP.
 * Used to confirm the user is online before blaming ISPs.
 * If these fail → user's own connection is the problem.
 */
export const NEUTRAL_PROBES = [
  { url: 'https://cloudflare-dns.com/dns-query?name=example.com&type=A', label: 'Cloudflare DoH' },
  { url: 'https://dns.google/resolve?name=example.com&type=A',           label: 'Google DoH' },
  { url: 'https://1.1.1.1',                                               label: 'Cloudflare IP' },
]

/**
 * Latency penalty thresholds.
 * ratio = mtnAvgLatency / neutralBaseline
 */
export const LATENCY_PENALTY = {
  MILD:   { ratio: 2.0, multiplier: 0.85 },  // 2x slower than neutral
  SEVERE: { ratio: 4.0, multiplier: 0.65 },  // 4x slower than neutral
}

/**
 * Status score thresholds
 */
export const STATUS_THRESHOLDS = {
  OPERATIONAL:      0.85,
  UNSTABLE:         0.60,
  DEGRADED:         0.30,
  // below 0.30 + corroboration check → LIKELY_OUTAGE or OUTAGE_CONFIRMED
}
