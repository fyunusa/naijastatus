/**
 * bank-probes.config.js
 *
 * Three-layer probe strategy per bank:
 *   Layer 1 — Website HTTP probe      (web server alive?)
 *   Layer 2 — iBank portal HTTP probe (application layer alive?)
 *   Layer 3 — DNS probe via DoH       (DNS resolution working?)
 *
 * Plus two ecosystem-wide checks:
 *   NIBSS — interbank backbone (if this fails, ALL transfers are failing)
 *   Paystack / Flutterwave — payment gateways with real status APIs
 *
 * Weight logic per bank:
 *   ibank_portal → 0.40  (strongest signal — app layer, not just web)
 *   dns_probe    → 0.35  (independent layer — DNS failure = serious)
 *   http_website → 0.25  (weakest — CDN may answer even during outages)
 *
 * NIBSS and gateway results feed into a separate ecosystem score,
 * not individual bank scores.
 */

export const BANK_PROBES = {
  GTBANK: {
    label: 'GTBank',
    shortName: 'GT Bank',
    color: '#FF6600',
    tier: 1,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://gtbank.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        // Internet banking login — only served if app stack is running
        url: 'https://ibank.gtbank.com',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=gtbank.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  ZENITH: {
    label: 'Zenith Bank',
    shortName: 'Zenith',
    color: '#CC0000',
    tier: 1,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://zenithbank.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://ibank.zenithbank.com',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=zenithbank.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  ACCESS: {
    label: 'Access Bank',
    shortName: 'Access',
    color: '#E87722',
    tier: 1,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://accessbankplc.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://ibank.accessbankplc.com',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=accessbankplc.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  FIRSTBANK: {
    label: 'First Bank',
    shortName: 'First Bank',
    color: '#003087',
    tier: 1,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://firstbanknigeria.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://ibank.firstbanknigeria.com',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=firstbanknigeria.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  UBA: {
    label: 'UBA',
    shortName: 'UBA',
    color: '#E00A0A',
    tier: 1,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://ubagroup.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://ibank.ubagroup.com',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=ubagroup.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  STANBIC: {
    label: 'Stanbic IBTC',
    shortName: 'Stanbic',
    color: '#00529F',
    tier: 1,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://stanbicibtcbank.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://ibtconline.stanbicibtcbank.com',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=stanbicibtcbank.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  FIDELITY: {
    label: 'Fidelity Bank',
    shortName: 'Fidelity',
    color: '#008000',
    tier: 2,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://fidelitybank.ng',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://ibank.fidelitybank.ng',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=fidelitybank.ng&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  STERLING: {
    label: 'Sterling Bank',
    shortName: 'Sterling',
    color: '#C8102E',
    tier: 2,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://sterling.ng',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://ibank.sterling.ng',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=sterling.ng&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  UNION: {
    label: 'Union Bank',
    shortName: 'Union',
    color: '#006838',
    tier: 2,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://unionbankng.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://unionbankng.com/personal-banking/internet-banking',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=unionbankng.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  KUDA: {
    label: 'Kuda Bank',
    shortName: 'Kuda',
    color: '#5F2EEA',
    tier: 2,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://kuda.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        // Kuda is app-first. Their web app is the closest equivalent.
        type: 'http',
        url: 'https://app.kuda.com',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=kuda.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  OPAY: {
    label: 'OPay',
    shortName: 'OPay',
    color: '#1FC164',
    tier: 2,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://opayweb.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://opayweb.com/login',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=opayweb.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  MONIEPOINT: {
    label: 'Moniepoint',
    shortName: 'Moniepoint',
    color: '#0047B3',
    tier: 2,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://moniepoint.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://app.moniepoint.com',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=moniepoint.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  WEMA: {
    label: 'Wema Bank',
    shortName: 'Wema',
    color: '#A6192E',
    tier: 2,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://wemabank.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://alat.ng',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=wemabank.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  FCMB: {
    label: 'FCMB',
    shortName: 'FCMB',
    color: '#5C068C',
    tier: 2,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://fcmb.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://ibank.fcmb.com',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=fcmb.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  PALMPAY: {
    label: 'PalmPay',
    shortName: 'PalmPay',
    color: '#FF4700',
    tier: 2,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://palmpay.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://app.palmpay.com',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=palmpay.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  CARBON: {
    label: 'Carbon',
    shortName: 'Carbon',
    color: '#0A001F',
    tier: 2,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://getcarbon.co',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://app.getcarbon.co',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=getcarbon.co&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  FAIRMONEY: {
    label: 'FairMoney',
    shortName: 'FairMoney',
    color: '#0D6EFD',
    tier: 2,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://fairmoney.io',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://fairmoney.io/login',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=fairmoney.io&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },

  PROVIDUS: {
    label: 'Providus Bank',
    shortName: 'Providus',
    color: '#E87722',
    tier: 2,
    probes: {
      http_website: {
        type: 'http',
        url: 'https://providusbank.com',
        weight: 0.25,
        timeout: 7000,
      },
      ibank_portal: {
        type: 'http',
        url: 'https://providusbank.com/business-banking',
        weight: 0.40,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=providusbank.com&type=A',
        weight: 0.35,
        timeout: 5000,
      },
    },
  },
}

/**
 * ECOSYSTEM PROBES
 * These don't belong to one bank — they reflect the health of
 * Nigeria's entire financial infrastructure.
 */
export const ECOSYSTEM_PROBES = {
  NIBSS: {
    label: 'NIBSS (Interbank)',
    description: 'Nigeria Interbank Settlement System — backbone of all bank transfers',
    // If NIBSS is unreachable, NIP (instant transfers) are failing across all banks
    probes: {
      http_primary: {
        type: 'http',
        url: 'https://nibss-plc.com.ng',
        weight: 0.50,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=nibss-plc.com.ng&type=A',
        weight: 0.50,
        timeout: 5000,
      },
    },
  },

  PAYSTACK: {
    label: 'Paystack',
    description: 'Payment gateway — real status API via Instatus',
    // Paystack uses Instatus — public JSON API, no auth needed
    // Pattern: https://{subdomain}.instatus.com/v3/summary.json
    statusApi: {
      type: 'status_api',
      url: 'https://status.paystack.com/v3/summary.json',
      provider: 'instatus',
      weight: 1.0,
      timeout: 8000,
    },
    // Fallback HTTP probe if status API fails
    http_fallback: {
      type: 'http',
      url: 'https://api.paystack.co',
      weight: 0.0,   // only used as fallback, not scored
      timeout: 6000,
    },
  },

  FLUTTERWAVE: {
    label: 'Flutterwave',
    description: 'Payment gateway — Atlassian statuspage',
    // Flutterwave uses Atlassian statuspage
    // Summary endpoint: https://status.flutterwave.com/api/v2/summary.json
    statusApi: {
      type: 'status_api',
      url: 'https://status.flutterwave.com/api/v2/summary.json',
      provider: 'atlassian',
      weight: 1.0,
      timeout: 8000,
    },
    http_fallback: {
      type: 'http',
      url: 'https://api.flutterwave.com',
      weight: 0.0,
      timeout: 6000,
    },
  },

  INTERSWITCH: {
    label: 'Interswitch',
    description: 'Card processing backbone — powers most Nigerian ATMs and POS',
    probes: {
      http_primary: {
        type: 'http',
        url: 'https://interswitchgroup.com',
        weight: 0.50,
        timeout: 7000,
      },
      dns_probe: {
        type: 'dns',
        url: 'https://cloudflare-dns.com/dns-query?name=interswitchgroup.com&type=A',
        weight: 0.50,
        timeout: 5000,
      },
    },
  },
}

/**
 * Status thresholds — same as ISP checker for consistency
 */
export const BANK_STATUS_THRESHOLDS = {
  OPERATIONAL:   0.85,
  UNSTABLE:      0.60,
  DEGRADED:      0.30,
}

/**
 * Instatus status mappings → NaijaStatus status
 */
export const INSTATUS_MAP = {
  UP:                'OPERATIONAL',
  HASISSUES:         'DEGRADED',
  UNDERMAINTENANCE:  'MAINTENANCE',
  DEGRADED:          'UNSTABLE',
}

/**
 * Atlassian statuspage indicator mappings → NaijaStatus status
 */
export const ATLASSIAN_MAP = {
  none:                 'OPERATIONAL',
  minor:                'UNSTABLE',
  major:                'DEGRADED',
  critical:             'OUTAGE_CONFIRMED',
  under_maintenance:    'MAINTENANCE',
}
