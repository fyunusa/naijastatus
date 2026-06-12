/**
 * NaijaStatus — UI Module
 * DOM rendering, card interactions, bottom sheet, search, dark mode
 */

import { getServices, getOverallHealth, getServiceCount, getReportsCount, reportIssue, searchServices } from './statusEngine.js';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let activeCategory = 'all';
let selectedService = null;
let selectedVote = null;

/**
 * Render status cards into grids
 */
export function renderCards() {
  const grids = {
    banks: document.getElementById('banks-grid'),
    isps: document.getElementById('isps-grid'),
    rides: document.getElementById('rides-grid'),
    utilities: document.getElementById('utilities-grid'),
  };

  // Clear all grids
  Object.values(grids).forEach((g) => (g.innerHTML = ''));

  const services = getServices('all');

  services.forEach((service) => {
    // Determine which grid to place it in
    let targetGrid;
    if (service.category === 'banks') targetGrid = grids.banks;
    else if (service.category === 'isps') targetGrid = grids.isps;
    else if (service.category === 'rides') targetGrid = grids.rides;
    else targetGrid = grids.utilities; // utilities, government all go here

    const card = document.createElement('div');
    card.className = 'status-card reveal';
    card.setAttribute('data-service-id', service.id);
    card.setAttribute('data-category', service.category);
    card.innerHTML = `
      <div class="status-ring ${service.status}">
        <img class="logo-img" src="${service.logo}" alt="${service.name}" onerror="this.style.display='none'" />
      </div>
      <div class="card-name">${service.name}</div>
      <div class="card-stats">
        <div class="card-stat">
          <span class="card-stat-value ${service.status}">${service.successRate}%</span>
          <span class="card-stat-label">Success</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-value" style="color: var(--text-primary)">${service.latency}ms</span>
          <span class="card-stat-label">Latency</span>
        </div>
      </div>
      <div class="card-status-badge ${service.status}">
        <span class="badge-dot"></span>
        ${service.status === 'operational' ? 'Operational' : service.status === 'degraded' ? 'Degraded' : 'Outage'}
      </div>
    `;

    card.addEventListener('click', () => openBottomSheet(service));
    targetGrid.appendChild(card);
  });
}

/**
 * Update cards on real-time status change
 */
export function updateCards(services) {
  services.forEach((service) => {
    const card = document.querySelector(`[data-service-id="${service.id}"]`);
    if (!card) return;

    const ring = card.querySelector('.status-ring');
    ring.className = `status-ring ${service.status}`;

    const successVal = card.querySelector('.card-stat-value');
    successVal.textContent = `${service.successRate}%`;
    successVal.className = `card-stat-value ${service.status}`;

    const latencyVal = card.querySelectorAll('.card-stat-value')[1];
    if (latencyVal) latencyVal.textContent = `${service.latency}ms`;

    const badge = card.querySelector('.card-status-badge');
    badge.className = `card-status-badge ${service.status}`;
    badge.innerHTML = `<span class="badge-dot"></span> ${service.status === 'operational' ? 'Operational' : service.status === 'degraded' ? 'Degraded' : 'Outage'}`;
  });

  // Update hero stats
  updateHeroStats();
}

/**
 * Update hero stats
 */
function updateHeroStats() {
  const healthEl = document.getElementById('overall-health');
  const servicesEl = document.getElementById('services-tracked');
  const reportsEl = document.getElementById('reports-today');

  const health = getOverallHealth();
  healthEl.textContent = `${health}%`;
  healthEl.className = 'stat-number';
  if (health < 70) healthEl.classList.add('danger');
  else if (health < 90) healthEl.classList.add('warning');

  servicesEl.textContent = getServiceCount();
  reportsEl.textContent = getReportsCount();
}

/**
 * Bottom sheet
 */
function openBottomSheet(service) {
  selectedService = service;
  selectedVote = null;

  document.getElementById('sheet-service-logo').src = service.logo;
  document.getElementById('sheet-service-logo').alt = service.name;
  document.getElementById('sheet-service-name').textContent = service.name;
  document.getElementById('sheet-service-category').textContent = service.category;

  // Render sector status details
  const sectorsContainer = document.getElementById('sheet-sectors-container');
  const sectorsGrid = document.getElementById('sheet-sectors-grid');
  sectorsGrid.innerHTML = '';

  if (service.sectors && service.sectors.length > 0) {
    sectorsContainer.style.display = 'block';
    service.sectors.forEach(sector => {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-secondary); border: 2px solid var(--border); border-radius: var(--radius-md); box-shadow: 0 3px 0 var(--border);';
      
      const statusClass = sector.status; // operational, degraded, outage
      const statusLabel = sector.status === 'operational' ? 'Operational' : sector.status === 'degraded' ? 'Degraded' : 'Outage';
      const dotColor = sector.status === 'operational' ? 'var(--status-green)' : sector.status === 'degraded' ? 'var(--status-yellow)' : 'var(--status-red)';
      const badgeBg = sector.status === 'operational' ? 'rgba(88, 204, 2, 0.12)' : sector.status === 'degraded' ? 'rgba(255, 200, 0, 0.12)' : 'rgba(255, 75, 75, 0.12)';
      const badgeTextColor = sector.status === 'operational' ? 'var(--status-green)' : sector.status === 'degraded' ? 'var(--status-yellow-shadow)' : 'var(--status-red)';

      item.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px; text-align: left;">
          <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${sector.name}</span>
          ${sector.detail ? `<span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">${sector.detail}</span>` : ''}
        </div>
        <div class="card-status-badge ${statusClass}" style="background: ${badgeBg}; color: ${badgeTextColor}; margin: 0; padding: 4px 10px; font-size: 0.65rem;">
          <span class="badge-dot" style="background: ${dotColor};"></span>
          ${statusLabel}
        </div>
      `;
      sectorsGrid.appendChild(item);
    });
  } else {
    sectorsContainer.style.display = 'none';
  }

  document.querySelectorAll('.report-option').forEach((btn) => btn.classList.remove('selected'));
  document.getElementById('report-details').value = '';

  document.getElementById('sheet-overlay').classList.add('active');
  document.getElementById('bottom-sheet').classList.add('active');
}

function closeBottomSheet() {
  document.getElementById('sheet-overlay').classList.remove('active');
  document.getElementById('bottom-sheet').classList.remove('active');
  selectedService = null;
  selectedVote = null;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('active');
  setTimeout(() => toast.classList.remove('active'), 3000);
}

/**
 * Category filtering
 */
function filterByCategory(category) {
  activeCategory = category;

  // Update pills
  document.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
  document.querySelector(`.pill[data-category="${category}"]`).classList.add('active');

  // Show/hide sections
  const sections = {
    banks: document.getElementById('banks'),
    isps: document.getElementById('isps'),
    rides: document.getElementById('rides'),
    utilities: document.getElementById('utilities'),
  };

  if (category === 'all') {
    Object.values(sections).forEach((s) => (s.style.display = ''));
  } else {
    Object.entries(sections).forEach(([key, section]) => {
      // Government is in utilities section
      if (category === 'government') {
        section.style.display = key === 'utilities' ? '' : 'none';
      } else {
        section.style.display = key === category ? '' : 'none';
      }
    });
  }

  // Smooth scroll to section
  if (category !== 'all') {
    const targetId = category === 'government' ? 'utilities' : category;
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Refresh ScrollTrigger so that GSAP recalculates scroll points for visual reveals
  ScrollTrigger.refresh();
}

/**
 * Search filtering
 */
function handleSearch(query) {
  const results = searchServices(query);
  const allCards = document.querySelectorAll('.status-card');

  if (!query.trim()) {
    allCards.forEach((card) => (card.style.display = ''));
    return;
  }

  const resultIds = new Set(results.map((r) => r.id));
  allCards.forEach((card) => {
    const id = card.getAttribute('data-service-id');
    card.style.display = resultIds.has(id) ? '' : 'none';
  });
}

/**
 * Dark mode
 */
function initDarkMode() {
  const toggle = document.getElementById('theme-toggle');
  const saved = localStorage.getItem('naijastatus-theme');

  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    toggle.textContent = '☀️';
  }

  toggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    toggle.textContent = isDark ? '🌙' : '☀️';
    localStorage.setItem('naijastatus-theme', isDark ? 'light' : 'dark');
  });
}

/**
 * Initialize UI
 */
export function initUI() {
  // Render initial cards
  renderCards();
  updateHeroStats();

  // Dark mode
  initDarkMode();

  // Category pills
  document.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      filterByCategory(pill.dataset.category);
    });
  });

  // Search
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));

  // Bottom sheet
  document.getElementById('sheet-overlay').addEventListener('click', closeBottomSheet);

  document.querySelectorAll('.report-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.report-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedVote = btn.dataset.vote;
    });
  });

  document.getElementById('report-submit').addEventListener('click', () => {
    if (!selectedService || !selectedVote) return;
    const details = document.getElementById('report-details').value;
    reportIssue(selectedService.id, selectedVote, details);
    closeBottomSheet();
    showToast('✅ Report submitted! Thank you.');
    updateHeroStats();
  });

  // Nav report buttons
  document.getElementById('nav-report-btn').addEventListener('click', () => {
    const services = getServices('all');
    if (services.length > 0) openBottomSheet(services[0]);
  });

  document.getElementById('hero-report-btn').addEventListener('click', () => {
    const services = getServices('all');
    if (services.length > 0) openBottomSheet(services[0]);
  });

  // Listen for real-time updates
  window.addEventListener('statusUpdate', (e) => {
    updateCards(e.detail.services);
  });
}
