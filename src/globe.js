/**
 * NaijaStatus — 3D Globe Module
 * Interactive Three.js globe via Globe.gl focused on Nigeria
 */

import * as THREE from 'three';

export function initGlobe() {
  const container = document.getElementById('globe-container');
  if (!container) return;

  // Dynamically import Globe.gl
  import('globe.gl').then(({ default: Globe }) => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Nigerian city coordinates
    const cities = [
      { name: 'Lagos', lat: 6.5244, lng: 3.3792, size: 0.8 },
      { name: 'Abuja', lat: 9.0579, lng: 7.4951, size: 0.7 },
      { name: 'Port Harcourt', lat: 4.8156, lng: 7.0498, size: 0.5 },
      { name: 'Kano', lat: 12.0022, lng: 8.5920, size: 0.6 },
      { name: 'Ibadan', lat: 7.3775, lng: 3.9470, size: 0.4 },
      { name: 'Enugu', lat: 6.4584, lng: 7.5464, size: 0.35 },
      { name: 'Kaduna', lat: 10.5105, lng: 7.4165, size: 0.35 },
      { name: 'Benin City', lat: 6.3350, lng: 5.6037, size: 0.35 },
    ];

    // Network arcs (simulated connections)
    const arcs = [
      { startLat: 6.5244, startLng: 3.3792, endLat: 9.0579, endLng: 7.4951, color: ['#58CC02', '#1CB0F6'] },
      { startLat: 6.5244, startLng: 3.3792, endLat: 4.8156, endLng: 7.0498, color: ['#58CC02', '#FFC800'] },
      { startLat: 9.0579, startLng: 7.4951, endLat: 12.0022, endLng: 8.5920, color: ['#1CB0F6', '#58CC02'] },
      { startLat: 6.5244, startLng: 3.3792, endLat: 7.3775, endLng: 3.9470, color: ['#58CC02', '#58CC02'] },
      { startLat: 9.0579, startLng: 7.4951, endLat: 6.4584, endLng: 7.5464, color: ['#1CB0F6', '#FFC800'] },
      { startLat: 4.8156, startLng: 7.0498, endLat: 6.3350, endLng: 5.6037, color: ['#FFC800', '#58CC02'] },
      { startLat: 12.0022, startLng: 8.5920, endLat: 10.5105, endLng: 7.4165, color: ['#58CC02', '#1CB0F6'] },
    ];

    // Create glassy transparent globe material
    const globeMaterial = new THREE.MeshPhongMaterial({
      color: isDark ? '#152b3c' : '#e0e4e8',
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });

    let hoverD = null;

    const globe = Globe()
      .showGlobe(true) // Show the sphere (circle)
      .showAtmosphere(true) // Atmosphere glow
      .atmosphereColor(isDark ? '#1CB0F6' : '#58CC02')
      .atmosphereAltitude(0.12)
      .backgroundColor(isDark ? '#0D1B2A' : '#F7F7F7')
      .globeMaterial(globeMaterial) // Apply glass material
      
      // Nigeria 3D Polygons (States)
      .polygonCapColor(d => d === hoverD 
        ? 'rgba(28, 176, 246, 0.75)' // Neon blue on hover
        : 'rgba(88, 204, 2, 0.35)'   // Branded semi-transparent green normally
      )
      .polygonSideColor(() => 'rgba(70, 163, 2, 0.25)')
      .polygonStrokeColor(() => '#46A302')
      .polygonAltitude(0.015)
      .polygonLabel(d => `
        <div style="background: var(--bg-secondary, #1B2D36); border: 2px solid var(--border, #2A3F4D); padding: 8px 12px; border-radius: 12px; color: var(--text-primary, #ECEFF1); font-family: var(--font-family); font-weight: 700; box-shadow: 0 4px 0 var(--border, #2A3F4D); pointer-events: none;">
          🇳🇬 ${d.properties.admin1Name} State
        </div>
      `)
      
      // Points (cities)
      .pointsData(cities)
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(0.02) // Layered slightly above polygon
      .pointRadius((d) => d.size * 0.3)
      .pointColor(() => '#1CB0F6') // Neon blue for contrast
      .pointResolution(12)
      
      // Arcs (network connections)
      .arcsData(arcs)
      .arcStartLat('startLat')
      .arcStartLng('startLng')
      .arcEndLat('endLat')
      .arcEndLng('endLng')
      .arcColor('color')
      .arcDashLength(0.4)
      .arcDashGap(0.2)
      .arcDashAnimateTime(1500)
      .arcStroke(0.6)
      
      // Labels (city names)
      .labelsData(cities)
      .labelLat('lat')
      .labelLng('lng')
      .labelText('name')
      .labelSize(1.2)
      .labelColor(() => isDark ? '#ECEFF1' : '#3C3C3C')
      .labelResolution(2)
      .labelAltitude(0.025) // Layered above points
      .labelDotRadius(0.3)
      (container);

    // Fetch and apply Nigeria States GeoJSON
    fetch('/nigeria-states.geojson')
      .then((res) => res.json())
      .then((geojson) => {
        globe.polygonsData(geojson.features);
      })
      .catch((err) => console.warn('Failed to load nigeria-states.geojson:', err));

    // Focus on Nigeria (zoomed in closer from 2.5 to 1.45)
    globe.pointOfView({ lat: 9.08, lng: 8.68, altitude: 1.45 }, 2000);

    // Navigation and Interactivity
    const controls = globe.controls();
    controls.autoRotate = false;
    controls.enableZoom = true;

    // Hover effect trigger
    globe.onPolygonHover(hoverObj => {
      hoverD = hoverObj;
      globe.polygonCapColor(globe.polygonCapColor()); // Force cap color recalculation
    });

    // Zoom into clicked state
    globe.onPolygonClick((polygon) => {
      let coords = [];
      if (polygon.geometry.type === 'Polygon') {
        coords = polygon.geometry.coordinates[0];
      } else if (polygon.geometry.type === 'MultiPolygon') {
        coords = polygon.geometry.coordinates[0][0];
      }

      if (coords.length > 0) {
        let sumLat = 0, sumLng = 0;
        coords.forEach(c => {
          sumLng += c[0];
          sumLat += c[1];
        });
        const lat = sumLat / coords.length;
        const lng = sumLng / coords.length;

        // Fly camera to the clicked state (altitude: 0.5 for close detail)
        globe.pointOfView({ lat, lng, altitude: 0.5 }, 1500);

        // Pause sway while user is inspecting
        cancelAnimationFrame(swayInterval);
        clearTimeout(swayTimeout);
        isDragging = true;

        // Reset view and resume sway after 6 seconds of inactivity
        swayTimeout = setTimeout(() => {
          isDragging = false;
          globe.pointOfView({ lat: 9.08, lng: 8.68, altitude: 1.45 }, 1500);
          swayTimeout = setTimeout(startSway, 1600);
        }, 6000);
      }
    });

    // Handle user drag pointer interaction
    let isDragging = false;
    let swayTimeout = null;
    let swayInterval = null;
    let swayAngle = 0;

    container.addEventListener('pointerdown', () => {
      isDragging = true;
      cancelAnimationFrame(swayInterval);
      clearTimeout(swayTimeout);
    });

    const handleRelease = () => {
      if (!isDragging) return;
      isDragging = false;
      swayTimeout = setTimeout(() => {
        globe.pointOfView({ lat: 9.08, lng: 8.68, altitude: 1.45 }, 1500);
        swayTimeout = setTimeout(startSway, 1600);
      }, 3000);
    };

    window.addEventListener('pointerup', handleRelease);
    window.addEventListener('pointercancel', handleRelease);

    function startSway() {
      if (isDragging) return;
      function sway() {
        if (isDragging) return;
        swayAngle += 0.003;
        const lat = 9.08 + Math.sin(swayAngle * 0.5) * 0.8;
        const lng = 8.68 + Math.sin(swayAngle) * 6.0;
        globe.pointOfView({ lat, lng, altitude: 1.45 });
        swayInterval = requestAnimationFrame(sway);
      }
      sway();
    }

    // Start sway after initial zoom in
    setTimeout(startSway, 2200);

    // Responsive sizing
    const handleResize = () => {
      globe.width(container.clientWidth);
      globe.height(container.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Listen for theme changes and update background and material color
    const observer = new MutationObserver(() => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      globe.backgroundColor(dark ? '#0D1B2A' : '#F7F7F7');
      globe.atmosphereColor(dark ? '#1CB0F6' : '#58CC02');
      if (globeMaterial) {
        globeMaterial.color.set(dark ? '#152b3c' : '#e0e4e8');
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  }).catch((err) => {
    console.warn('Globe.gl failed to load, showing fallback:', err);
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--bg-secondary);border-radius:var(--radius-xl);">
        <span style="font-size:4rem;">🌍</span>
      </div>
    `;
  });
}
