/**
 * NaijaStatus — Status Engine
 * Mock data engine simulating real-time success rates and latency
 */

const SERVICES = [
  // Banks & FinTech
  { id: 'gtbank', name: 'GTBank', category: 'banks', logo: '/logos/gtbank.svg', successRate: 94, latency: 180, status: 'operational' },
  { id: 'zenith', name: 'Zenith Bank', category: 'banks', logo: '/logos/zenith.svg', successRate: 98, latency: 120, status: 'operational' },
  { id: 'access', name: 'Access Bank', category: 'banks', logo: '/logos/access.svg', successRate: 91, latency: 210, status: 'operational' },
  { id: 'firstbank', name: 'FirstBank', category: 'banks', logo: '/logos/firstbank.svg', successRate: 87, latency: 320, status: 'degraded' },
  { id: 'uba', name: 'UBA', category: 'banks', logo: '/logos/uba.svg', successRate: 96, latency: 140, status: 'operational' },
  { id: 'opay', name: 'OPay', category: 'banks', logo: '/logos/opay.svg', successRate: 99, latency: 80, status: 'operational' },
  { id: 'palmpay', name: 'PalmPay', category: 'banks', logo: '/logos/palmpay.svg', successRate: 97, latency: 95, status: 'operational' },
  { id: 'kuda', name: 'Kuda', category: 'banks', logo: '/logos/kuda.svg', successRate: 95, latency: 110, status: 'operational' },
  { id: 'moniepoint', name: 'Moniepoint', category: 'banks', logo: '/logos/moniepoint.svg', successRate: 98, latency: 90, status: 'operational' },

  // ISPs & Telcos
  { id: 'mtn', name: 'MTN', category: 'isps', logo: '/logos/mtn.svg', successRate: 92, latency: 45, status: 'operational' },
  { id: 'airtel', name: 'Airtel', category: 'isps', logo: '/logos/airtel.svg', successRate: 88, latency: 62, status: 'degraded' },
  { id: 'glo', name: 'Glo', category: 'isps', logo: '/logos/glo.svg', successRate: 75, latency: 110, status: 'degraded' },
  { id: '9mobile', name: '9mobile', category: 'isps', logo: '/logos/9mobile.svg', successRate: 82, latency: 85, status: 'degraded' },
  { id: 'starlink', name: 'Starlink', category: 'isps', logo: '/logos/starlink.svg', successRate: 99, latency: 25, status: 'operational' },
  { id: 'spectranet', name: 'Spectranet', category: 'isps', logo: '/logos/spectranet.svg', successRate: 90, latency: 55, status: 'operational' },

  // Ride-Hailing
  { id: 'bolt', name: 'Bolt', category: 'rides', logo: '/logos/bolt.svg', successRate: 93, latency: 200, status: 'operational' },
  { id: 'uber', name: 'Uber', category: 'rides', logo: '/logos/uber.svg', successRate: 96, latency: 150, status: 'operational' },
  { id: 'indrive', name: 'InDrive', category: 'rides', logo: '/logos/indrive.svg', successRate: 89, latency: 250, status: 'degraded' },

  // Utilities & Portals
  { id: 'ikedc', name: 'IKEDC', category: 'utilities', logo: '/logos/ikedc.svg', successRate: 80, latency: 400, status: 'degraded' },
  { id: 'ekedc', name: 'EKEDC', category: 'utilities', logo: '/logos/ekedc.svg', successRate: 78, latency: 450, status: 'degraded' },
  { id: 'jamb', name: 'JAMB', category: 'government', logo: '/logos/jamb.svg', successRate: 70, latency: 600, status: 'outage' },
  { id: 'nysc', name: 'NYSC', category: 'government', logo: '/logos/nysc.svg', successRate: 85, latency: 350, status: 'degraded' },
];

// Deep clone so we can mutate
let services = JSON.parse(JSON.stringify(SERVICES));
let reports = 247; // Simulated starting count

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

// Start simulation
setInterval(simulateUpdates, 5000);

/**
 * Public API
 */
export function getServices(category) {
  if (!category || category === 'all') return services;
  return services.filter((s) => s.category === category);
}

export function getAllServices() {
  return services;
}

export function getOverallHealth() {
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
