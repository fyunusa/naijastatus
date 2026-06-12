/**
 * NaijaStatus — Animations Module
 * GSAP ScrollTrigger: card reveals, counter animations, section heading fades
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getOverallHealth, getServiceCount, getReportsCount } from './statusEngine.js';

gsap.registerPlugin(ScrollTrigger);

export function initAnimations() {
  // ---- Hero heading word-by-word reveal ----
  const heroHeading = document.querySelector('.hero-heading');
  if (heroHeading) {
    gsap.fromTo(heroHeading,
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.3 }
    );
  }

  // ---- Hero subtitle ----
  const heroSub = document.querySelector('.hero-subtitle');
  if (heroSub) {
    gsap.fromTo(heroSub,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', delay: 0.5 }
    );
  }

  // ---- Search bar ----
  const searchBar = document.querySelector('.search-bar');
  if (searchBar) {
    gsap.fromTo(searchBar,
      { y: 25, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', delay: 0.7 }
    );
  }

  // ---- Hero stats counter animation ----
  const healthEl = document.getElementById('overall-health');
  const servicesEl = document.getElementById('services-tracked');
  const reportsEl = document.getElementById('reports-today');

  if (healthEl) {
    animateCounter(healthEl, getOverallHealth(), '%', 0.9);
  }
  if (servicesEl) {
    animateCounter(servicesEl, getServiceCount(), '', 1.1);
  }
  if (reportsEl) {
    animateCounter(reportsEl, getReportsCount(), '', 1.3);
  }

  // ---- Hero stats row ----
  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) {
    gsap.fromTo(heroStats,
      { y: 25, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', delay: 0.9 }
    );
  }

  // ---- Hero actions ----
  const heroActions = document.querySelector('.hero-actions');
  if (heroActions) {
    gsap.fromTo(heroActions,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', delay: 1.1 }
    );
  }

  // ---- Globe container ----
  const globeContainer = document.getElementById('globe-container');
  if (globeContainer) {
    gsap.fromTo(globeContainer,
      { scale: 0.8, opacity: 0 },
      { scale: 1, opacity: 1, duration: 1.2, ease: 'power3.out', delay: 0.5 }
    );
  }

  // ---- Section headings (scroll-triggered, Duolingo-style slide-in) ----
  gsap.utils.toArray('.section-heading').forEach((heading) => {
    gsap.fromTo(heading,
      { x: -60, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: heading,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        }
      }
    );
  });

  // ---- Status cards (staggered bounce-in from below) ----
  gsap.utils.toArray('.status-grid').forEach((grid) => {
    const cards = grid.querySelectorAll('.status-card');
    gsap.fromTo(cards,
      { y: 50, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        stagger: 0.08,
        ease: 'back.out(1.4)',
        scrollTrigger: {
          trigger: grid,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        }
      }
    );
  });

  // ---- Category pills (subtle entrance) ----
  const pills = document.querySelectorAll('.pill');
  gsap.fromTo(pills,
    { y: 20, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 0.4,
      stagger: 0.06,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.category-bar',
        start: 'top 90%',
        toggleActions: 'play none none reverse',
      }
    }
  );
}

/**
 * Animate a counter from 0 to targetValue
 */
function animateCounter(element, targetValue, suffix = '', delay = 0) {
  const obj = { val: 0 };
  gsap.to(obj, {
    val: targetValue,
    duration: 1.5,
    delay,
    ease: 'power2.out',
    onUpdate: () => {
      element.textContent = `${Math.round(obj.val)}${suffix}`;
    },
  });
}
