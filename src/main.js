/**
 * NaijaStatus — Main Entry Point
 * Initializes Lenis smooth scroll, GSAP, Globe, UI, and Animations
 */

import './style.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initServices } from './statusEngine.js';
import { initGlobe } from './globe.js';
import { initUI } from './ui.js';
import { initAnimations } from './animations.js';
import { initISPMonitor } from './isp-monitor.js';
import { initBankMonitor } from './bank-monitor.js';

gsap.registerPlugin(ScrollTrigger);

// ---- Initialize Lenis Smooth Scroll ----
const lenis = new Lenis({
  lerp: 0.1,
  smoothWheel: true,
  wheelMultiplier: 1,
});

// Sync Lenis with GSAP's ticker
lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

// ---- Initialize Modules ----
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Fetch dynamic services data first (banks, ISPs, rides, utilities)
  await initServices();

  // 2. UI (render cards, wire events, dark mode)
  initUI();

  // 2.5. Initialize High-Fidelity ISP Status Monitoring
  initISPMonitor();

  // 2.6. Initialize High-Fidelity Bank Status Monitoring
  initBankMonitor();

  // 3. Globe (3D visualization)
  initGlobe();

  // 4. Animations (GSAP ScrollTrigger reveals)
  // Small delay to let cards render first
  requestAnimationFrame(() => {
    initAnimations();
  });
});
