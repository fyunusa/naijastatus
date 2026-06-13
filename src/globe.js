/**
 * NaijaStatus — 3D Globe Module
 * Interactive Three.js globe via Globe.gl focused on Nigeria's 36 states
 */

import * as THREE from 'three';

export function initGlobe() {
  const container = document.getElementById('globe-container');
  if (!container) return;

  // Dynamically import Globe.gl
  import('globe.gl').then(({ default: Globe }) => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

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
        ? 'rgba(28, 176, 246, 0.50)' // Neon blue on hover
        : 'rgba(88, 204, 2, 0.15)'   // Subtle translucent green normally
      )
      .polygonSideColor(() => 'rgba(70, 163, 2, 0.05)')
      .polygonStrokeColor(() => 'rgba(88, 204, 2, 0.45)')
      .polygonAltitude(0.015)
      .polygonLabel(d => `
        <div style="background: var(--bg-secondary, #1B2D36); border: 2px solid var(--border, #2A3F4D); padding: 8px 12px; border-radius: 12px; color: var(--text-primary, #ECEFF1); font-family: var(--font-family); font-weight: 700; box-shadow: 0 4px 0 var(--border, #2A3F4D); pointer-events: none;">
          🇳🇬 ${d.properties.admin1Name} State
        </div>
      `)
      
      // Points (Nigeria States Centroids)
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(0.02) // Layered slightly above polygon
      .pointRadius(() => 0.07) // Sized sharply for 37 nodes
      .pointColor(() => '#1CB0F6') // Neon blue for contrast
      .pointResolution(12)
      
      // Arcs (network connections)
      .arcStartLat('startLat')
      .arcStartLng('startLng')
      .arcEndLat('endLat')
      .arcEndLng('endLng')
      .arcColor('color')
      .arcDashLength(0.4)
      .arcDashGap(0.2)
      .arcDashAnimateTime(1500)
      .arcStroke(0.6)
      .arcAltitude(0.08)
      (container);

    // Fetch and apply Nigeria States GeoJSON, states list & network connections
    Promise.all([
      fetch('/nigeria-states.geojson').then((res) => res.json()),
      fetch('/data/states.json').then((res) => res.json()),
      fetch('/data/connections.json').then((res) => res.json())
    ])
    .then(([geojson, states, arcConnections]) => {
      // Set Polygons
      globe.polygonsData(geojson.features);

      // Set Points (using state centroids)
      globe.pointsData(states);

      // Map connection list to coordinates dynamically
      const arcs = [];
      arcConnections.forEach(conn => {
        const fromState = states.find(s => s.name === conn.from);
        const toState = states.find(s => s.name === conn.to);
        if (fromState && toState) {
          arcs.push({
            startLat: fromState.lat,
            startLng: fromState.lng,
            endLat: toState.lat,
            endLng: toState.lng,
            color: conn.color
          });
        }
      });

      globe.arcsData(arcs);
    })
    .catch((err) => console.warn('Failed to load geographic datasets:', err));

    // Focus on Nigeria (zoomed in closer from 1.45 to 0.48)
    globe.pointOfView({ lat: 9.08, lng: 8.68, altitude: 0.48 }, 2000);

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

        // Fly camera to the clicked state (altitude: 0.35 for close detail)
        globe.pointOfView({ lat, lng, altitude: 0.35 }, 1500);

        // Pause sway while user is inspecting
        cancelAnimationFrame(swayInterval);
        clearTimeout(swayTimeout);
        isDragging = true;

        // Reset view and resume sway after 6 seconds of inactivity
        swayTimeout = setTimeout(() => {
          isDragging = false;
          globe.pointOfView({ lat: 9.08, lng: 8.68, altitude: 0.48 }, 1500);
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
        globe.pointOfView({ lat: 9.08, lng: 8.68, altitude: 0.48 }, 1500);
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
        globe.pointOfView({ lat, lng, altitude: 0.48 });
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
