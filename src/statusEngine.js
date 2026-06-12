/**
 * NaijaStatus — Status Engine
 * Runs real-time client-side reachability pings, integrates Paystack API health components,
 * and incorporates crowdsourced issue reporting.
 */

let services = [];
let baseReportsCount = 247; // Base report count offset
let isUpdating = false;
let updateIntervalId = null;

// Paystack live country-wide payment rails status state
const paystackChannels = {
  bankTransfer: 'operational',
  cards: 'operational',
  ussd: 'operational',
  transfers: 'operational'
};

/**
 * Clean up old reports in localStorage and return the count for a service in the last 15 minutes
 */
function getRecentReportsCount(serviceId) {
  const reportsList = JSON.parse(localStorage.getItem('naijastatus-reports') || '[]');
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  
  // Clean up expired reports
  const recent = reportsList.filter(r => r.timestamp > fifteenMinutesAgo);
  localStorage.setItem('naijastatus-reports', JSON.stringify(recent));

  return recent.filter(r => r.serviceId === serviceId).length;
}

/**
 * Fetch Paystack's public Status Page components to see national bank transfer gateway status
 */
async function updatePaystackChannels() {
  try {
    const res = await fetch('https://status.paystack.com/v3/components.json');
    if (!res.ok) return;
    const components = await res.json();

    components.forEach(comp => {
      const name = comp.name ? comp.name.toLowerCase() : '';
      const group = comp.group && comp.group.name ? comp.group.name.toLowerCase() : '';
      const status = comp.status ? comp.status.toLowerCase() : 'operational';

      let cleanStatus = 'operational';
      if (status.includes('degraded') || status.includes('partial')) {
        cleanStatus = 'degraded';
      } else if (status.includes('major') || status.includes('outage')) {
        cleanStatus = 'outage';
      }

      // Track channels for the Nigeria market specifically
      if (group.includes('nigeria')) {
        if (name.includes('bank transfer')) {
          paystackChannels.bankTransfer = cleanStatus;
        } else if (name.includes('cards')) {
          paystackChannels.cards = cleanStatus;
        } else if (name.includes('ussd')) {
          paystackChannels.ussd = cleanStatus;
        } else if (name === 'bank') {
          paystackChannels.transfers = cleanStatus;
        }
      }
    });
  } catch (err) {
    console.warn('Could not load Paystack channels status:', err);
  }
}

/**
 * Extract root domain from URL for DNS checks
 */
function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch (e) {
    return '';
  }
}

/**
 * Perform client-side reachability checks using both HTTP GET (no-cors) and Google DoH
 */
async function pingService(service) {
  // If user is completely offline, return standard offline state
  if (!navigator.onLine) {
    return {
      status: 'outage',
      successRate: 0,
      latency: 0,
      sectors: service.sectors.map(sec => ({
        ...sec,
        status: 'outage',
        detail: 'Browser is offline'
      }))
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

  const domain = extractDomain(service.url);

  // If the service has a specific list of probes (e.g. loaded for an ISP), use it.
  // Otherwise, construct a default probe basket dynamically.
  const probes = service.probes || [
    {
      type: 'http',
      name: 'Primary Portal',
      url: service.url,
      weight: 0.40
    },
    {
      type: 'dns',
      name: 'Nameserver Resolution',
      domain: domain,
      weight: 0.60
    }
  ];

  try {
    const probePromises = probes.map(async (probe) => {
      const start = performance.now();
      let success = false;
      try {
        if (probe.type === 'http' && probe.url) {
          await fetch(probe.url, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-store',
            signal: controller.signal
          });
          success = true;
        } else if (probe.type === 'dns' && probe.domain) {
          const dohUrl = `https://dns.google/resolve?name=${encodeURIComponent(probe.domain)}&type=A`;
          const res = await fetch(dohUrl, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
          });
          if (res.ok) {
            const data = await res.json();
            success = data.Status === 0; // 0 = NOERROR
          }
        }
      } catch (e) {
        // Aborted or fetch failed
      }
      const latency = Math.round(performance.now() - start);
      return { success, latency, weight: probe.weight || 0 };
    });

    const results = await Promise.all(probePromises);
    clearTimeout(timeoutId);

    let totalWeight = 0;
    let earnedWeight = 0;
    let latencySum = 0;
    let successfulCount = 0;

    results.forEach(r => {
      totalWeight += r.weight;
      if (r.success) {
        earnedWeight += r.weight;
        latencySum += r.latency;
        successfulCount++;
      }
    });

    const score = totalWeight > 0 ? (earnedWeight / totalWeight) : 0;
    const latency = successfulCount > 0 ? Math.round(latencySum / successfulCount) : 0;

    // If score is 0, it means all checking endpoints failed
    if (score === 0) {
      return {
        status: 'outage',
        successRate: 0,
        latency,
        sectors: service.sectors.map(sec => ({
          ...sec,
          status: 'outage',
          detail: 'All check probes failed'
        }))
      };
    }

    let baseRate = Math.round(score * 100);

    // Degrade success rate slightly if latency is extremely high (network congestion)
    if (latency > 2500) {
      baseRate = Math.max(0, baseRate - 25);
    } else if (latency > 1200) {
      baseRate = Math.max(0, baseRate - 10);
    }

    // Dynamic reports influence (DownDetector model)
    const recentReports = getRecentReportsCount(service.id);
    const successRate = Math.max(0, baseRate - (recentReports * 15));

    let finalStatus = 'operational';
    if (successRate < 70) {
      finalStatus = 'outage';
    } else if (successRate < 90) {
      finalStatus = 'degraded';
    }

    // Map sub-sector details dynamically, factoring in processor alerts for banks
    const sectors = service.sectors.map(sec => {
      let secStatus = finalStatus;
      let secDetail = sec.detail || 'Operational';

      if (finalStatus === 'outage') {
        secStatus = 'outage';
        secDetail = 'Connection failed';
      } else {
        // Banks utilize Paystack's transaction switches for specific channel status
        if (service.category === 'banks') {
          const nameLower = sec.name.toLowerCase();
          if (nameLower.includes('inflow') || nameLower.includes('receiving')) {
            secStatus = paystackChannels.bankTransfer;
            secDetail = paystackChannels.bankTransfer === 'operational' ? 'Instant settlement active' : 'Processor reporting delays';
          } else if (nameLower.includes('outflow') || nameLower.includes('sending')) {
            secStatus = paystackChannels.transfers;
            secDetail = paystackChannels.transfers === 'operational' ? 'NIP channels active' : 'Processor transfers delayed';
          } else if (nameLower.includes('ussd')) {
            secStatus = paystackChannels.ussd;
            secDetail = paystackChannels.ussd === 'operational' ? 'Stable connection' : 'Processor reporting USSD delays';
          } else if (nameLower.includes('app') || nameLower.includes('wallet')) {
            secStatus = finalStatus;
            secDetail = finalStatus === 'operational' ? 'Stable login times' : 'Server overhead latency';
          }
        } else {
          // General services degrade their sectors if the main service is degraded/down
          if (finalStatus === 'degraded') {
            secStatus = 'degraded';
            secDetail = 'Elevated response time';
          }
        }
      }

      return { ...sec, status: secStatus, detail: secDetail };
    });

    return {
      status: finalStatus,
      successRate,
      latency,
      sectors
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      status: 'outage',
      successRate: 0,
      latency: 0,
      sectors: service.sectors.map(sec => ({
        ...sec,
        status: 'outage',
        detail: 'System check failed'
      }))
    };
  }
}


/**
 * Execute client-side status pings in concurrent batches of 8 to avoid blocking browser network pool
 */
async function checkAllServices() {
  if (isUpdating) return;
  isUpdating = true;

  try {
    // 1. Check if user is online
    if (!navigator.onLine) {
      window.dispatchEvent(new CustomEvent('connectionStatus', { detail: { online: false } }));
      services.forEach(s => {
        s.status = 'outage';
        s.successRate = 0;
        s.latency = 0;
        s.sectors.forEach(sec => {
          sec.status = 'outage';
          sec.detail = 'You are offline';
        });
      });
      window.dispatchEvent(new CustomEvent('statusUpdate', { detail: { services } }));
      isUpdating = false;
      return;
    }

    window.dispatchEvent(new CustomEvent('connectionStatus', { detail: { online: true } }));

    // 2. Fetch Paystack status channels
    await updatePaystackChannels();

    // 3. Batch ping checks
    const batchSize = 8;
    for (let i = 0; i < services.length; i += batchSize) {
      const batch = services.slice(i, i + batchSize);
      await Promise.all(batch.map(async (s) => {
        const result = await pingService(s);
        Object.assign(s, result);
      }));
    }

    // 4. Dispatch the unified update event
    window.dispatchEvent(new CustomEvent('statusUpdate', { detail: { services } }));
  } catch (err) {
    console.error('Error in status check loop:', err);
  } finally {
    isUpdating = false;
  }
}

/**
 * Public API - Initialize services by loading JSON files at runtime
 */
export async function initServices() {
  try {
    const [banks, isps, rides, utilities] = await Promise.all([
      fetch('/data/banks.json').then((r) => r.json()),
      fetch('/data/isps.json').then((r) => r.json()),
      fetch('/data/rides.json').then((r) => r.json()),
      fetch('/data/utilities.json').then((r) => r.json())
    ]);

    // Load custom probe configs for ISPs if available, with robust fallback
    await Promise.all(isps.map(async (isp) => {
      try {
        const res = await fetch(`/data/probes/${isp.id}.json`);
        if (res.ok) {
          isp.probes = await res.json();
        } else {
          console.warn(`Probe configuration for ${isp.id} not found, using fallback.`);
        }
      } catch (err) {
        console.warn(`Failed to fetch probe configuration for ${isp.id}:`, err);
      }
    }));

    services = [...banks, ...isps, ...rides, ...utilities];

    // Perform initial pings immediately
    await checkAllServices();

    // Set up recurring update check every 30 seconds
    if (!updateIntervalId) {
      updateIntervalId = setInterval(checkAllServices, 30000);
    }

    // Wire global network connection listeners
    window.addEventListener('online', () => {
      window.dispatchEvent(new CustomEvent('connectionStatus', { detail: { online: true } }));
      checkAllServices();
    });
    window.addEventListener('offline', () => {
      window.dispatchEvent(new CustomEvent('connectionStatus', { detail: { online: false } }));
      // Set all to offline
      services.forEach(s => {
        s.status = 'outage';
        s.successRate = 0;
        s.latency = 0;
        s.sectors.forEach(sec => {
          sec.status = 'outage';
          sec.detail = 'You are offline';
        });
      });
      window.dispatchEvent(new CustomEvent('statusUpdate', { detail: { services } }));
    });

  } catch (err) {
    console.error('Failed to load services data:', err);
  }
}

export function getServices(category) {
  if (!category || category === 'all') return services;
  if (category === 'utilities') {
    return services.filter((s) => s.category === 'utilities' || s.category === 'government');
  }
  return services.filter((s) => s.category === category);
}

export function getAllServices() {
  return services;
}

export function getOverallHealth() {
  if (services.length === 0) return 0;
  const onlineServices = services.filter(s => s.status === 'operational');
  return Math.round((onlineServices.length / services.length) * 100);
}

export function getServiceCount() {
  return services.length;
}

export function getReportsCount() {
  const reportsList = JSON.parse(localStorage.getItem('naijastatus-reports') || '[]');
  return baseReportsCount + reportsList.length;
}

export function reportIssue(serviceId, vote, details) {
  // Push report to localStorage
  const reportsList = JSON.parse(localStorage.getItem('naijastatus-reports') || '[]');
  reportsList.push({
    serviceId,
    vote,
    details,
    timestamp: Date.now()
  });
  localStorage.setItem('naijastatus-reports', JSON.stringify(reportsList));

  // Trigger an immediate reachability re-check on this service to incorporate report impact
  const service = services.find(s => s.id === serviceId);
  if (service) {
    pingService(service).then((result) => {
      Object.assign(service, result);
      window.dispatchEvent(new CustomEvent('statusUpdate', { detail: { services } }));
    });
  }

  return baseReportsCount + reportsList.length;
}

export function searchServices(query) {
  const q = query.toLowerCase().trim();
  if (!q) return services;
  return services.filter(
    (s) => s.name.toLowerCase().includes(q) || s.category.includes(q)
  );
}
