/**
 * NaijaStatus — Main Entry Point
 * Initializes Lenis smooth scroll, GSAP, Globe, UI, and Animations
 */

import './style.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initGlobe } from './globe.js';
import { initUI } from './ui.js';
import { initAnimations } from './animations.js';

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
document.addEventListener('DOMContentLoaded', () => {
  // 1. UI (render cards, wire events, dark mode)
  initUI();

  // 2. Globe (3D visualization)
  initGlobe();

  // 3. Animations (GSAP ScrollTrigger reveals)
  // Small delay to let cards render first
  requestAnimationFrame(() => {
    initAnimations();
  });
});
