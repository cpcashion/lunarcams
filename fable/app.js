// LunarCams Fable — app orchestration.
// Seven windows, one real sky. Vanilla JS, no build step.

import {
  ephemeris, siteSky, siteFrame, nextSunrise, nextSunset, nextNewMoon, nextFullMoon,
  homeFacing, lunationNumber, norm180, SYNODIC_DAYS,
} from './ephemeris.js';
import { createScene, makeTerrain, renderThumb } from './scene.js';
import { createEarthRenderer } from './earth.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

// ---------- the seven windows ----------
const SITES = [
  {
    id: 'LW-01', name: 'Shackleton Rim', place: 'SOUTH POLE · 89.7°S 0.0°E', lat: -89.7, lon: 0,
    terrain: 'polar', seed: 11, artifact: 'mast', artifactAz: 38,
    blurb: 'the peak of near-eternal light',
  },
  {
    id: 'LW-02', name: 'Statio Tranquillitatis', place: 'SEA OF TRANQUILITY · 0.7°N 23.5°E', lat: 0.67, lon: 23.47,
    terrain: 'mare', seed: 23, artifact: 'lander', artifactAz: 261,
    blurb: 'the first window — Earth almost overhead',
  },
  {
    id: 'LW-03', name: 'Mare Crisium', place: 'EASTERN LIMB · 17.0°N 59.1°E', lat: 17.0, lon: 59.1,
    terrain: 'basin', seed: 37, artifact: null,
    blurb: 'sunrise reaches the nearside here first',
  },
  {
    id: 'LW-04', name: 'Aristarchus Plateau', place: 'OCEAN OF STORMS · 23.7°N 47.4°W', lat: 23.7, lon: -47.4,
    terrain: 'highland', seed: 41, artifact: null,
    blurb: 'the brightest ground on the Moon',
  },
  {
    id: 'LW-05', name: 'Sinus Iridum', place: 'BAY OF RAINBOWS · 44.1°N 31.5°W', lat: 44.1, lon: -31.5,
    terrain: 'highland', seed: 53, artifact: null,
    blurb: 'a drowned crater with a mountain shore',
  },
  {
    id: 'LW-06', name: 'Montes Cordillera', place: 'ORIENTALE RIM · 20.6°S 87.1°W', lat: -20.6, lon: -87.1,
    terrain: 'basin', seed: 67, artifact: null,
    blurb: 'the western shore — Earth skims the horizon',
  },
  {
    id: 'LW-07', name: 'Schrödinger Basin', place: 'FAR SIDE · 75.0°S 132.4°E', lat: -75.0, lon: 132.4,
    terrain: 'farside', seed: 79, artifact: 'dish', artifactAz: 140,
    blurb: 'no Earth ever rises here — only stars',
  },
];
for (const s of SITES) s.yaw = 0; // set at first framing

// ---------- state ----------
const state = {
  siteIdx: 0,
  offsetMs: 0,            // time machine offset from "now"
  yaw: 0, pitch: 8, fov: 70,
  vyaw: 0, vpitch: 0,     // drag inertia
  dragging: false,
  lastInteract: 0,
  home: loadHome(),
  earthScale: 2.2,
  scrubbing: false,
};
const terrains = new Map(SITES.map((s) => [s.id, makeTerrain(s)]));
const site = () => SITES[state.siteIdx];
const tNow = () => Date.now() + state.offsetMs;

const sceneCanvas = $('scene');
const scene = createScene(sceneCanvas);
const earthR = createEarthRenderer();
let lastEarthRender = 0;
let earthOut = null;

// ---------- framing ----------
function defaultFraming(keepYaw) {
  const eph = ephemeris(tNow());
  const sky = siteSky(eph, site());
  let yaw;
  if (sky.earth.alt > -2) yaw = sky.earth.az;
  else if (sky.sun.alt > -6) yaw = sky.sun.az;
  else yaw = site().seed * 37 % 360;
  if (!keepYaw) state.yaw = yaw;
  state.pitch = sky.earth.alt > -2
    ? Math.max(3, Math.min(20, sky.earth.alt * 0.45))
    : 6;
  state.vyaw = 0; state.vpitch = 0;
}
function computeFov() {
  const w = sceneCanvas.getBoundingClientRect().width || innerWidth;
  state.fov = Math.max(46, Math.min(80, 30 + w / 24));
  state.earthScale = w < 700 ? 2.8 : 2.2;
  $('earthScaleNote') && ($('earthScaleNote').textContent = `${state.earthScale}×`);
}
computeFov();
defaultFraming(false);

// ---------- earth disc view ----------
function earthView(eph, sky) {
  return {
    subLat: eph.subLunar.lat,
    subLon: eph.subLunar.lon,
    sunLat: eph.subSolar.lat,
    sunLon: eph.subSolar.lon,
    northAngle: sky.northAngle,
    cloudT: eph.ms / 3600000,
    home: state.home ? { lat: state.home.lat, lon: state.home.lon } : null,
  };
}

// ---------- main loop ----------
let fadeEl = null;
let rafId = 0;
function loop() {
  const t = tNow();
  const eph = ephemeris(t);
  const sky = siteSky(eph, site());

  // inertia + idle drift
  if (!state.dragging) {
    state.yaw += state.vyaw; state.pitch += state.vpitch;
    state.vyaw *= 0.94; state.vpitch *= 0.94;
    state.pitch = clamp(state.pitch, -10, 62);
  }
  const drift = (!reduced && Date.now() - state.lastInteract > 6000)
    ? Math.sin(Date.now() / 26000) * 1.1 : 0;

  // earth offscreen (throttled; cheap cache-hit otherwise)
  const nowMs = performance.now();
  if (nowMs - lastEarthRender > (state.scrubbing ? 120 : 400)) {
    lastEarthRender = nowMs;
    const size = state.scrubbing ? 220 : 460;
    earthOut = earthR.render(size, earthView(eph, sky));
  }

  scene.render({
    site: site(), terrain: terrains.get(site().id), eph, sky,
    yaw: state.yaw + drift, pitch: state.pitch, fov: state.fov,
    earth: earthOut, earthScale: state.earthScale,
    tNow: Date.now(), quality: state.scrubbing ? 'low' : 'high',
    grain: !reduced,
  });

  rafId = requestAnimationFrame(loop);
}

// ---------- HUD (1 Hz) ----------
function fmtDeg(v) { return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}°`; }
function fmtDur(ms) {
  const neg = ms < 0; ms = Math.abs(ms);
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60;
  const core = d > 0 ? `${d}d ${String(h).padStart(2, '0')}h` : h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
  return (neg ? '−' : '+') + core;
}
function subsolarMoonLon(eph) {
  const f0 = siteFrame(eph, 0, 0);
  const s = eph.sunFromMoon;
  const x = s[0] * f0.zenith[0] + s[1] * f0.zenith[1] + s[2] * f0.zenith[2];
  const y = s[0] * f0.east[0] + s[1] * f0.east[1] + s[2] * f0.east[2];
  return Math.atan2(y, x) * 180 / Math.PI;
}
function stateLine(sky, eph) {
  const s = site();
  const sunAlt = sky.sun.alt, earthAlt = sky.earth.alt;
  const rising = sunAltDelta(eph.ms) > 0;
  if (s.terrain === 'polar' && Math.abs(sunAlt) < 3.2)
    return 'The sun circles the horizon here — never rising far, never fully leaving.';
  if (s.terrain === 'farside' && sunAlt < 0)
    return 'The far shore. No Earth in this sky, ever — only stars, two weeks deep.';
  if (sunAlt > 12) return 'High noon of a two-week day. The shadows hide under the rocks.';
  if (sunAlt > 0) return rising
    ? 'A sunrise two Earth-days long is underway.'
    : 'The long sunset — darkness arrives at walking pace.';
  if (earthAlt > 0 && eph.earthIllum > 0.96) return 'Full Earth tonight. The ground glows blue with earthlight.';
  if (earthAlt > 0 && earthAlt < 9) return 'Night. Earth hangs low over the ridge and never climbs, never sets.';
  if (earthAlt > 0) return `Night, lit by earthlight — home is ${Math.round(eph.earthIllum * 100)}% full and shining.`;
  return 'Deep night. Fourteen days of it, and the stars do not twinkle.';
}
function sunAltDelta(ms) {
  const s = site();
  const a1 = siteSky(ephemeris(ms), s).sun.alt;
  const a2 = siteSky(ephemeris(ms + 3600000), s).sun.alt;
  return a2 - a1;
}
function updateHud() {
  const t = tNow();
  const eph = ephemeris(t);
  const sky = siteSky(eph, site());
  $('roSun').textContent = `${fmtDeg(sky.sun.alt)} ALT · AZ ${Math.round(sky.sun.az)}°`;
  $('roEarth').textContent = sky.earth.alt > -1.5
    ? `${fmtDeg(sky.earth.alt)} ALT · ${Math.round(eph.earthIllum * 100)}% FULL`
    : 'BELOW HORIZON — FAR SIDE';
  const ha = norm180(site().lon - subsolarMoonLon(eph));
  const solFrac = ((ha + 180) / 360 + 1) % 1; // 0 midnight, 0.5 noon
  const dayHalf = solFrac > 0.25 && solFrac < 0.75;
  const sinceEdge = dayHalf ? (solFrac - 0.25) : (solFrac < 0.25 ? solFrac + 0.25 : solFrac - 0.75);
  $('roSol').textContent = `${dayHalf ? 'DAYLIGHT' : 'NIGHT'} · ${(sinceEdge * SYNODIC_DAYS).toFixed(1)} OF ${(SYNODIC_DAYS / 2).toFixed(1)} DAYS`;
  $('roTemp').textContent = `≈ ${sky.tempC}°C REGOLITH`;
  $('stateLine').textContent = stateLine(sky, eph);

  const pill = $('livePill'), pillText = $('livePillText');
  if (Math.abs(state.offsetMs) > 30000) {
    pill.classList.add('simulated');
    pillText.textContent = `Simulated ${fmtDur(state.offsetMs)}`;
  } else {
    pill.classList.remove('simulated');
    pillText.textContent = 'Live geometry';
  }
  const lbl = $('scrubLabel');
  if (Math.abs(state.offsetMs) > 30000) {
    lbl.hidden = false;
    lbl.textContent = `T ${fmtDur(state.offsetMs)} · ${new Date(t).toISOString().slice(5, 16).replace('T', ' ')} UTC`;
  } else lbl.hidden = true;

  const now = new Date();
  $('barClock').textContent = `${now.toISOString().slice(11, 19)} UTC · LUNATION ${lunationNumber(Date.now())} · DAY ${ephemeris(Date.now()).moonAgeDays.toFixed(1)}`;
}

// ---------- dock ----------
const dockEl = $('dock');
function buildDock() {
  dockEl.innerHTML = '';
  for (let i = 0; i < SITES.length; i++) {
    const s = SITES[i];
    const card = document.createElement('button');
    card.className = 'dock-card' + (i === state.siteIdx ? ' active' : '');
    card.role = 'tab';
    card.setAttribute('aria-selected', i === state.siteIdx);
    card.innerHTML = `<canvas width="132" height="58"></canvas>
      <span class="dc-name">${s.name}</span>
      <span class="dc-state" data-state></span>`;
    card.addEventListener('click', () => switchSite(i));
    dockEl.appendChild(card);
    s._card = card;
  }
  paintDock();
}
function paintDock() {
  const eph = ephemeris(tNow());
  for (const s of SITES) {
    const sky = siteSky(eph, s);
    s.yaw = sky.earth.alt > -2 ? sky.earth.az : sky.sun.az;
    renderThumb(s._card.querySelector('canvas'), s, terrains.get(s.id), sky);
    const st = s._card.querySelector('[data-state]');
    st.textContent = sky.sun.alt > 0
      ? `Day · sun ${Math.round(sky.sun.alt)}°`
      : sky.earth.alt > 0 ? `Night · earthlit` : `Night · dark`;
  }
}
function switchSite(i, viaKeys) {
  if (i === state.siteIdx) return;
  state.siteIdx = (i + SITES.length) % SITES.length;
  crossfade(() => {
    defaultFraming(false);
    $('siteNo').textContent = site().id;
    $('siteName').textContent = site().name;
    $('sitePlace').textContent = `${site().place} · ${site().blurb.toUpperCase()}`;
    updateHud();
  });
  for (let k = 0; k < SITES.length; k++) {
    SITES[k]._card.classList.toggle('active', k === state.siteIdx);
    SITES[k]._card.setAttribute('aria-selected', k === state.siteIdx);
  }
  if (!viaKeys) site()._card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
}
function crossfade(mid) {
  if (!fadeEl) {
    fadeEl = document.createElement('div');
    fadeEl.style.cssText = 'position:absolute;inset:0;background:#020204;opacity:0;transition:opacity .34s;pointer-events:none;z-index:5';
    $('window').appendChild(fadeEl);
  }
  if (reduced) { mid(); return; }
  fadeEl.style.opacity = '1';
  setTimeout(() => { mid(); fadeEl.style.opacity = '0'; }, 360);
}

// ---------- drag to look ----------
let px = 0, py = 0, moved = 0;
sceneCanvas.addEventListener('pointerdown', (e) => {
  state.dragging = true; moved = 0;
  px = e.clientX; py = e.clientY;
  state.vyaw = 0; state.vpitch = 0;
  sceneCanvas.classList.add('dragging');
  sceneCanvas.setPointerCapture(e.pointerId);
  state.lastInteract = Date.now();
});
sceneCanvas.addEventListener('pointermove', (e) => {
  if (!state.dragging) return;
  const w = sceneCanvas.getBoundingClientRect().width;
  const ppd = w / state.fov;
  const dx = e.clientX - px, dy = e.clientY - py;
  moved += Math.abs(dx) + Math.abs(dy);
  state.yaw -= dx / ppd;
  state.pitch = clamp(state.pitch + dy / ppd, -10, 62);
  state.vyaw = -dx / ppd * 0.5; state.vpitch = dy / ppd * 0.5;
  px = e.clientX; py = e.clientY;
  state.lastInteract = Date.now();
  if (moved > 30) $('dragHint').classList.add('gone');
});
function endDrag() { state.dragging = false; sceneCanvas.classList.remove('dragging'); }
sceneCanvas.addEventListener('pointerup', endDrag);
sceneCanvas.addEventListener('pointercancel', endDrag);
setTimeout(() => $('dragHint').classList.add('gone'), 9000);

// smooth look-at animation
let anim = null;
function lookAt(az, alt) {
  state.lastInteract = Date.now();
  const fromYaw = state.yaw, fromPitch = state.pitch;
  const dYaw = norm180(az - fromYaw);
  const toPitch = clamp(alt, -6, 58);
  const t0 = performance.now(), dur = reduced ? 0 : 900;
  cancelAnimationFrame(anim);
  const step = (tm) => {
    const k = dur ? Math.min(1, (tm - t0) / dur) : 1;
    const e = k * k * (3 - 2 * k);
    state.yaw = fromYaw + dYaw * e;
    state.pitch = fromPitch + (toPitch - fromPitch) * e;
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
$('findEarth').addEventListener('click', () => {
  const sky = siteSky(ephemeris(tNow()), site());
  if (sky.earth.alt < -1.5) { flashState('No Earth in this sky — this is the far side.'); return; }
  lookAt(sky.earth.az, Math.max(4, sky.earth.alt * (sky.earth.alt > 30 ? 0.85 : 0.5)));
});
$('findSun').addEventListener('click', () => {
  const sky = siteSky(ephemeris(tNow()), site());
  if (sky.sun.alt < -2) { flashState('The sun is down — night here lasts around 354 hours.'); return; }
  lookAt(sky.sun.az, Math.max(3, sky.sun.alt * 0.6));
});
let flashTimer = 0;
function flashState(msg) {
  const el = $('stateLine');
  el.textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(updateHud, 4000);
}

// ---------- time machine ----------
const scrub = $('scrub');
scrub.addEventListener('input', () => {
  state.offsetMs = Number(scrub.value) * 1000;
  state.scrubbing = true;
  state.lastInteract = Date.now();
  updateHud();
});
scrub.addEventListener('change', () => { state.scrubbing = false; paintDock(); updateHud(); });
function setOffset(ms) {
  state.offsetMs = ms;
  scrub.value = String(clamp(Math.round(ms / 1000), Number(scrub.min), Number(scrub.max)));
  paintDock(); updateHud();
}
$('goLive').addEventListener('click', () => setOffset(0));
// visible sunrise/sunset: when the sun actually crosses the local skyline, not the flat horizon
function sunAboveSkyline(ms) {
  const sky = siteSky(ephemeris(ms), site());
  return sky.sun.alt - terrains.get(site().id).top(sky.sun.az) - 0.55; // clear by a full disc
}
function nextSkylineCross(from, dir) {
  const step = 45 * 60000;
  let prev = sunAboveSkyline(from);
  for (let t = from + step; t <= from + 32 * 86400000; t += step) {
    const cur = sunAboveSkyline(t);
    if ((dir > 0 && prev < 0 && cur >= 0) || (dir < 0 && prev > 0 && cur <= 0)) {
      let lo = t - step, hi = t;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        const v = sunAboveSkyline(mid);
        if ((dir > 0 && v < 0) || (dir < 0 && v > 0)) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    }
    prev = cur;
  }
  return null;
}
$('jumpSunrise').addEventListener('click', () => {
  const t = nextSkylineCross(tNow(), +1) ?? nextSunrise(tNow(), site());
  jumpTo(t, 'No sunrise here in the next month.', 0);
  lookAtSunSoon();
});
$('jumpSunset').addEventListener('click', () => {
  const t = nextSkylineCross(tNow(), -1) ?? nextSunset(tNow(), site());
  jumpTo(t, 'No sunset here in the next month.', 0);
  lookAtSunSoon();
});
function lookAtSunSoon() {
  setTimeout(() => {
    const sky = siteSky(ephemeris(tNow()), site());
    if (sky.sun.alt > -3) lookAt(sky.sun.az, Math.max(3, sky.sun.alt * 0.6));
  }, 80);
}
$('jumpFullEarth').addEventListener('click', () => {
  if (site().terrain === 'farside') { flashState('No Earth in this sky — try a nearside window.'); return; }
  jumpTo(nextNewMoon(tNow()), null);
});
$('jumpNoon').addEventListener('click', () => {
  // next local noon: the subsolar meridian sweeps to this site's longitude
  const eph = ephemeris(tNow());
  const ha = norm180(subsolarMoonLon(eph) - site().lon); // deg the sun still has to travel? sweep is westward
  const rate = 360 / (SYNODIC_DAYS * 86400000);           // deg per ms, westward
  const wait = (((ha % 360) + 360) % 360) / rate;
  jumpTo(tNow() + wait, null);
});
function jumpTo(target, failMsg, nudgeMs = 60000) {
  if (!target) { if (failMsg) flashState(failMsg); return; }
  // land a touch past the event so the moment reads clearly on screen
  setOffset(target - Date.now() + nudgeMs);
}

// ---------- ambient ----------
$('ambientBtn').addEventListener('click', () => {
  document.body.classList.add('ambient');
  if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { document.body.classList.remove('ambient'); }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
  if (e.key === 'ArrowRight') switchSite(state.siteIdx + 1, true);
  if (e.key === 'ArrowLeft') switchSite(state.siteIdx - 1, true);
  if (e.key === ' ') { e.preventDefault(); setOffset(0); }
});
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('ambient');
});

// ---------- almanac ----------
function drawPhase() {
  const c = $('phaseCanvas');
  const ctx = c.getContext('2d');
  const S = c.width, r = S * 0.36, cx = S / 2, cy = S / 2;
  const eph = ephemeris(Date.now());
  ctx.clearRect(0, 0, S, S);
  // dark disc
  ctx.fillStyle = '#14151a';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // lit portion: two elliptical arcs (northern-hemisphere orientation, lit side correct)
  const k = Math.cos(eph.elong * Math.PI / 180); // -1 full .. +1 new
  const east = eph.waxing ? 1 : -1;              // waxing lights the right side
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  // outer limb (lit side)
  ctx.ellipse(cx, cy, r, r, 0, -Math.PI / 2, Math.PI / 2, east < 0);
  // terminator
  ctx.ellipse(cx, cy, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === (east > 0));
  ctx.closePath();
  ctx.clip();
  const g = ctx.createRadialGradient(cx - r * 0.2 * east, cy - r * 0.2, r * 0.2, cx, cy, r * 1.15);
  g.addColorStop(0, '#EFEAE0'); g.addColorStop(1, '#B9B2A4');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // faint maria blotches
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#6d675c';
  const blobs = [[-0.28, -0.32, 0.30], [0.12, -0.38, 0.22], [0.3, -0.05, 0.26], [-0.05, 0.02, 0.2], [-0.45, 0.1, 0.14]];
  for (const [bx, by, br] of blobs) {
    ctx.beginPath(); ctx.arc(cx + bx * r, cy + by * r, br * r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // rim
  ctx.strokeStyle = 'rgba(233,226,212,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

  const names = ['New Moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full Moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  const idx = Math.round(eph.lunation * 8) % 8;
  $('phaseCaption').innerHTML = `${names[idx]} · ${Math.round(eph.moonIllum * 100)}% lit<br>as seen from Earth right now`;
}
let distBase = null;
function renderAlmanac() {
  const now = Date.now();
  const eph = ephemeris(now);
  const yesterday = ephemeris(now - 86400000);
  const drift = eph.moonDist - yesterday.moonDist;
  const fm = nextFullMoon(now), nm = nextNewMoon(now);
  const fmt = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    + ' · ~' + new Date(ms).toISOString().slice(11, 16) + ' UTC';
  const stats = [
    ['Illumination', `${(eph.moonIllum * 100).toFixed(1)}<span class="unit">%</span>`, eph.waxing ? 'waxing' : 'waning'],
    ['Age', `${eph.moonAgeDays.toFixed(1)}<span class="unit">of ${SYNODIC_DAYS.toFixed(1)} days</span>`, `lunation no. ${lunationNumber(now)}`],
    ['Distance', `<span id="distLive">${Math.round(eph.moonDist).toLocaleString('en-US')}</span><span class="unit">km</span>`, `${drift >= 0 ? 'receding' : 'approaching'} ${Math.abs(drift / 24).toFixed(0)} km/h`],
    ['Next full Moon', fmt(fm), 'full Moon = new Earth'],
    ['Next new Moon', fmt(nm), 'new Moon = full Earth'],
    ['Light delay', `${(eph.moonDist / 299792.458).toFixed(2)}<span class="unit">s</span>`, 'every photon is late'],
  ];
  $('statGrid').innerHTML = stats.map(([t, v, sub]) =>
    `<div class="stat"><dt>${t}</dt><dd>${v}<span class="sub">${sub}</span></dd></div>`).join('');

  const trq = siteSky(eph, SITES[1]);
  $('almanacLine').innerHTML = `From the Moon tonight, Earth is <span class="hl">${Math.round(eph.earthIllum * 100)}% full</span>, hanging ${Math.round(trq.earth.alt)}° over the Sea of Tranquility — and it never sets.`;
  drawPhase();
}

// ---------- home ----------
function loadHome() {
  try { return JSON.parse(localStorage.getItem('lcf-home')) || null; } catch { return null; }
}
function saveHome() {
  try {
    if (state.home) localStorage.setItem('lcf-home', JSON.stringify(state.home));
    else localStorage.removeItem('lcf-home');
  } catch {}
}
$('homeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('homeInput').value.trim();
  if (!q) return;
  const status = $('homeStatus');
  const coordMatch = q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    state.home = { name: 'Your spot', lat: +coordMatch[1], lon: +coordMatch[2] };
    saveHome(); renderHome(); status.textContent = '';
    return;
  }
  status.textContent = 'Searching…';
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
    const json = await res.json();
    const hit = json?.results?.[0];
    if (!hit) { status.textContent = 'No luck — try a bigger town nearby, or "lat, lon".'; return; }
    state.home = { name: hit.name, region: hit.admin1 || hit.country || '', lat: hit.latitude, lon: hit.longitude };
    saveHome(); renderHome(); status.textContent = '';
  } catch {
    status.textContent = 'Search is unreachable — you can enter coordinates as "lat, lon".';
  }
});
$('homeForget').addEventListener('click', () => {
  state.home = null; saveHome(); renderHome();
});
const homeEarthR = createEarthRenderer();
function renderHomeEarth() {
  const c = $('homeEarth');
  const ctx = c.getContext('2d');
  const eph = ephemeris(Date.now());
  const { canvas, homePt } = homeEarthR.render(c.width, {
    subLat: eph.subLunar.lat, subLon: eph.subLunar.lon,
    sunLat: eph.subSolar.lat, sunLon: eph.subSolar.lon,
    northAngle: 0, cloudT: eph.ms / 3600000,
    home: state.home ? { lat: state.home.lat, lon: state.home.lon } : null,
  });
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0);
  if (homePt) {
    ctx.strokeStyle = 'rgba(255,214,140,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(homePt.x, homePt.y, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,224,170,1)';
    ctx.beginPath(); ctx.arc(homePt.x, homePt.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  $('homeEarthCap').innerHTML = state.home
    ? (homePt ? 'Facing the Moon now — home is marked' : 'The hemisphere facing the Moon —<br>home is around the far side right now')
    : 'The hemisphere facing the Moon right now';
}
function renderHome() {
  renderHomeEarth();
  const box = $('homeResult');
  if (!state.home) { box.classList.remove('on'); return; }
  box.classList.add('on');
  const now = Date.now();
  const hf = homeFacing(now, state.home.lon);
  const eph = ephemeris(now);
  // day or night at home?
  const cosDay = Math.sin(eph.subSolar.lat * Math.PI / 180) * Math.sin(state.home.lat * Math.PI / 180)
    + Math.cos(eph.subSolar.lat * Math.PI / 180) * Math.cos(state.home.lat * Math.PI / 180)
    * Math.cos((eph.subSolar.lon - state.home.lon) * Math.PI / 180);
  const nightAtHome = cosDay < 0;
  const nm = state.home.name + (state.home.region ? `, ${state.home.region}` : '');
  if (hf.facingNow) {
    $('homeBig').innerHTML = `<span class="hl">${nm}</span> is facing the Moon right now.`;
    const centerIn = hf.nextCenterMs - now;
    $('homeDetail').textContent = (centerIn < 3600000 * 2 ? 'It passes dead-center under the Moon within the hour. ' :
      `Dead-center pass in ${fmtDur(centerIn).slice(1)}. `)
      + (nightAtHome ? 'It is night there — look for your city lights on the dark side of the Earth in the windows above.'
        : 'It is daytime there — find the gold marker on the Earth in the windows above.');
  } else {
    $('homeBig').innerHTML = `<span class="hl">${nm}</span> turns to face the Moon in ${fmtDur(hf.nextCenterMs - now).slice(1)}.`;
    $('homeDetail').textContent = 'Earth carries your home around once every 24 hours and 50 minutes. '
      + (nightAtHome ? 'Right now it is night there.' : 'Right now the sun is up there.')
      + ' When it swings into view, a gold marker will pulse on the Earth in every window.';
  }
}

// ---------- arrivals ----------
const CURATED = [
  { name: "Chang'e 7", agency: 'CNSA', net: '2026-08-31T00:00:00Z', precision: 'Month', desc: 'Orbiter, lander and rover bound for the south pole, hunting water ice for the International Lunar Research Station.' },
  { name: 'Griffin Mission One', agency: 'Astrobotic', net: '2026-11-30T00:00:00Z', precision: 'Month', desc: "Astrobotic's Griffin lander carries NASA CLPS payloads toward the lunar south pole." },
  { name: 'Nova-C IM-3', agency: 'Intuitive Machines', net: '2026-12-31T00:00:00Z', precision: 'Month', desc: 'Third Nova-C landing, targeting the magnetic swirls of Reiner Gamma.' },
  { name: 'Blue Ghost Mission 2', agency: 'Firefly Aerospace', net: '2026-12-31T00:00:00Z', precision: 'Month', desc: 'Far-side lander deploying a lunar relay satellite on the way.' },
  { name: 'Artemis III', agency: 'NASA', net: '2027-06-30T00:00:00Z', precision: 'Month', desc: 'The first crewed landing since 1972, aimed at the south polar region.' },
];
const TERMS = ['lunar', 'moon', 'Artemis', 'Chang\'e', 'Chandrayaan', 'Blue Ghost', 'Nova-C', 'Griffin'];
async function fetchArrivals() {
  const KEY = 'lcf-arrivals-v1';
  try {
    const c = JSON.parse(localStorage.getItem(KEY));
    if (c && Date.now() - c.at < 45 * 60000) return c.events;
  } catch {}
  try {
    const batches = await Promise.all(TERMS.map((t) =>
      fetch(`https://ll.thespacedevs.com/2.3.0/launches/upcoming/?search=${encodeURIComponent(t)}&limit=12`,
        { signal: AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((j) => j.results || [])
        .catch(() => [])));
    const byId = new Map();
    for (const b of batches) for (const e of b) {
      if (!e.net || byId.has(e.id)) continue;
      byId.set(e.id, {
        name: e.mission?.name || e.name,
        agency: e.launch_service_provider?.name || 'Unknown',
        net: e.net,
        precision: e.net_precision?.name || 'Day',
        desc: e.mission?.description || '',
        live: !!e.webcast_live,
      });
    }
    const events = [...byId.values()]
      .filter((e) => new Date(e.net).getTime() > Date.now() - 14 * 86400000)
      .sort((a, b) => new Date(a.net) - new Date(b.net))
      .slice(0, 8);
    if (!events.length) throw new Error('empty');
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), events }));
    return events;
  } catch {
    return CURATED;
  }
}
let arrivals = [];
function renderArrivals() {
  const el = $('arrivalsList');
  if (!arrivals.length) return;
  const now = Date.now();
  el.innerHTML = arrivals.map((e) => {
    const t = new Date(e.net).getTime();
    const isLive = e.live || (now - t > -30 * 60000 && now - t < 6 * 3600000);
    const when = e.precision === 'Month'
      ? new Date(e.net).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase()
      : new Date(e.net).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
    const count = isLive ? 'UNDERWAY'
      : t > now && t - now < 90 * 86400000 ? `T−${fmtDur(t - now).slice(1)}` : '';
    return `<div class="arrival">
      <span class="when">${when}</span>
      <span class="who"><span class="n">${esc(e.name)}</span><span class="a">${esc(e.agency)}</span>${e.desc ? `<span class="d">${esc(e.desc)}</span>` : ''}</span>
      <span class="count${isLive ? ' live' : ''}">${count}</span>
    </div>`;
  }).join('');
  $('arrivalsNote').textContent = arrivals === CURATED
    ? 'Live schedule unreachable — showing the curated manifest. Dates shift; space is hard.'
    : 'Tracked live from Launch Library 2. Dates shift; space is hard.';
}
function esc(s) { const d = document.createElement('i'); d.textContent = s ?? ''; return d.innerHTML; }

// ---------- reveal on scroll ----------
const io = new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { threshold: 0.12 });
document.querySelectorAll('.rv').forEach((el) => io.observe(el));

// ---------- boot ----------
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
window.addEventListener('resize', () => { scene.resize(); computeFov(); });

$('siteNo').textContent = site().id;
$('siteName').textContent = site().name;
$('sitePlace').textContent = `${site().place} · ${site().blurb.toUpperCase()}`;
$('earthScaleNote').textContent = `${state.earthScale}×`;
buildDock();
updateHud();
renderAlmanac();
renderHome();
loop();
setInterval(updateHud, 1000);
setInterval(paintDock, 60000);
setInterval(renderAlmanac, 60000);
setInterval(renderHome, 30000);
fetchArrivals().then((ev) => { arrivals = ev; renderArrivals(); setInterval(renderArrivals, 1000); });
