/**
 * NaijaStatus — Status Engine
 * Loads services dynamically from separate JSON files and simulates real-time success rates & latency
 */

let services = [];
let reports = 247; // Simulated starting count
let intervalId = null;

function getStatusFromRate(rate) {
  if (rate >= 90) return 'operational';
  if (rate >= 70) return 'degraded';
  return 'outage';
}

/**
 * Simulate real-time fluctuations
 */
function simulateUpdates() {
  services.forEach((s) => {
    const delta = (Math.random() - 0.5) * 4; // ±2%
    s.successRate = Math.max(0, Math.min(100, Math.round(s.successRate + delta)));
    s.latency = Math.max(10, Math.round(s.latency + (Math.random() - 0.5) * 30));
    s.status = getStatusFromRate(s.successRate);
  });

  // Dispatch custom event
  window.dispatchEvent(new CustomEvent('statusUpdate', { detail: { services } }));
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

    services = [...banks, ...isps, ...rides, ...utilities];

    // Start simulation after successfully loading
    if (!intervalId) {
      intervalId = setInterval(simulateUpdates, 5000);
    }
  } catch (err) {
    console.error('Failed to load services data:', err);
  }
}

export function getServices(category) {
  if (!category || category === 'all') return services;
  // Government is also in the utilities grid section
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
  const avg = services.reduce((sum, s) => sum + s.successRate, 0) / services.length;
  return Math.round(avg);
}

export function getServiceCount() {
  return services.length;
}

export function getReportsCount() {
  return reports;
}

export function reportIssue(serviceId, vote, details) {
  reports++;
  console.log(`Report: ${serviceId} — ${vote} — ${details}`);
  return reports;
}

export function searchServices(query) {
  const q = query.toLowerCase().trim();
  if (!q) return services;
  return services.filter(
    (s) => s.name.toLowerCase().includes(q) || s.category.includes(q)
  );
}
