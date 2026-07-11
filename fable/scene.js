// LunarCams Fable — the window renderer.
// A painterly panorama from a lunar site. The land is procedural; everything
// in the sky (sun, Earth, 555 brightest stars, the galactic band) is placed
// by the real ephemeris for the chosen instant.

import { STARS } from './data.js';
import { raDecToEclipticVec, norm180 } from './ephemeris.js';

const RAD = Math.PI / 180;

// ---------- deterministic noise, periodic over 360 deg of azimuth ----------
function h1(n, seed) {
  const x = Math.sin(n * 127.1 + seed * 311.7 + 74.7) * 43758.5453;
  return x - Math.floor(x);
}
function pnoise(az, seed, lattice) {
  lattice = Math.round(lattice); // must be integer or the 0/360 seam tears
  const x = (((az % 360) + 360) % 360) / 360 * lattice;
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = h1(i % lattice, seed), b = h1((i + 1) % lattice, seed);
  return a + (b - a) * u;
}

// ---------- star vectors (ecliptic frame), precomputed once ----------
const STAR_VECS = STARS.map(([ra, dec, mag, ci]) => ({ v: raDecToEclipticVec(ra, dec), mag, ci }));
// galactic equator: 160 points, built in equatorial coords then -> ecliptic
const GALAXY = (() => {
  const pole = raDecToEclipticVec(192.859, 27.128);
  // two basis vectors perpendicular to the pole
  let b1 = [pole[1], -pole[0], 0];
  const l1 = Math.hypot(...b1) || 1; b1 = b1.map((v) => v / l1);
  const b2 = [
    pole[1] * b1[2] - pole[2] * b1[1],
    pole[2] * b1[0] - pole[0] * b1[2],
    pole[0] * b1[1] - pole[1] * b1[0],
  ];
  const pts = [];
  for (let i = 0; i < 160; i++) {
    const t = (i / 160) * Math.PI * 2;
    pts.push({
      v: [
        b1[0] * Math.cos(t) + b2[0] * Math.sin(t),
        b1[1] * Math.cos(t) + b2[1] * Math.sin(t),
        b1[2] * Math.cos(t) + b2[2] * Math.sin(t),
      ],
      w: 0.55 + 0.45 * h1(i, 5),          // patchiness along the band
    });
  }
  return pts;
})();

function starColor(ci) {
  if (ci < 0.05) return [168, 192, 255];
  if (ci < 0.4) return [212, 226, 255];
  if (ci < 0.85) return [255, 249, 238];
  if (ci < 1.3) return [255, 231, 196];
  return [255, 202, 164];
}

// ---------- terrain ----------
export function makeTerrain(site) {
  const s = site.seed;
  const T = site.terrain; // 'polar' | 'mare' | 'highland' | 'basin' | 'farside'
  // amplitudes are horizon relief in degrees; a rim peak sees low, distant mountains,
  // so even 'polar' stays under ~1.8 deg and the grazing sun can clear the ridges
  const amp = { polar: 1.7, highland: 2.2, basin: 2.6, mare: 0.9, farside: 2.9 }[T] || 2;
  const rough = { polar: 1.0, highland: 0.6, basin: 0.75, mare: 0.35, farside: 0.85 }[T] || 0.6;

  function ridge(az, seed, base, a, lat1, lat2) {
    let v = (pnoise(az, seed, lat1) - 0.5) * 2 * a
      + (pnoise(az, seed + 13, lat2) - 0.5) * a * 0.55 * rough
      + (pnoise(az, seed + 29, lat2 * 2.7) - 0.5) * a * 0.22 * rough;
    if (T === 'polar') v = Math.abs(v) * 1.25 - a * 0.3; // jagged peaks
    return base + v;
  }
  // a few gentle crater rims worked into the near layer
  const craters = [];
  for (let k = 0; k < 3; k++) {
    craters.push({ az: h1(k, s + 3) * 360, w: 16 + h1(k, s + 4) * 20, a: 0.35 + h1(k, s + 5) * 0.6 });
  }
  function craterBump(az) {
    let v = 0;
    for (const c of craters) {
      const d = norm180(az - c.az) / c.w;
      // raised rim with a shallow saddle in the middle
      v += c.a * (Math.exp(-Math.pow((Math.abs(d) - 0.85) * 2.6, 2)) - 0.28 * Math.exp(-Math.pow(d * 1.4, 2)));
    }
    return v;
  }
  const detail = (az, seed) => (pnoise(az, seed, 89) - 0.5) * 0.14 * rough;
  const layers = [
    { p: (az) => ridge(az, s + 1, amp * 0.55, amp, 7, 19) + detail(az, s + 61), depth: 0 },
    { p: (az) => ridge(az, s + 2, amp * 0.1, amp * 0.8, 11, 27) + detail(az, s + 62), depth: 1 },
    { p: (az) => ridge(az, s + 3, -amp * 0.28, amp * 0.5, 17, 41) + craterBump(az) + detail(az, s + 63), depth: 2 },
  ];
  // scattered foreground rocks: az, drop below horizon (deg), size (deg)
  const rocks = [];
  for (let k = 0; k < 40; k++) {
    rocks.push({
      az: h1(k, s + 7) * 360,
      drop: 1.2 + Math.pow(h1(k, s + 8), 1.5) * 8.5,
      size: 0.05 + h1(k, s + 9) * 0.16,
      tone: h1(k, s + 10),
    });
  }
  // the visible skyline height at an azimuth (for "when does the sun actually clear the ridge")
  const top = (az) => Math.max(layers[0].p(az), layers[1].p(az), layers[2].p(az));
  return { layers, rocks, amp, top };
}

// ---------- lighting palette ----------
function palette(sunAlt, earthAlt) {
  const dayF = smooth(-1, 14, sunAlt);           // 0 night -> 1 day
  const grazing = Math.exp(-Math.pow((sunAlt - 4) / 7, 2)); // golden band near horizon
  const earthlit = earthAlt > 0 ? smooth(0, 10, earthAlt) : 0;

  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // terrain base tones per layer depth, night -> day (far layers darkest)
  const nightBase = [
    mix3([4, 5, 8], [10, 13, 19], earthlit),
    mix3([6, 7, 10], [13, 16, 23], earthlit),
    mix3([8, 9, 12], [17, 20, 28], earthlit),
  ];
  const dayBase = [[84, 82, 77], [112, 109, 102], [148, 144, 136]];
  const bases = nightBase.map((nb, i) => mix3(nb, dayBase[i], dayF));

  return {
    dayF, grazing, earthlit,
    bases,
    rim: mix3(earthlit ? [126, 150, 188] : [40, 42, 50], [255, 214, 156], Math.max(dayF * 0.6, grazing)),
    starAlpha: 1 - dayF * 0.82,
    groundTop: nightToDay(nightBase[2], dayBase[2], dayF, 0.84),
    groundBot: nightToDay(nightBase[2], dayBase[2], dayF, 0.52),
  };
  function nightToDay(nb, db, t, k) {
    return [(nb[0] + (db[0] - nb[0]) * t) * k, (nb[1] + (db[1] - nb[1]) * t) * k, (nb[2] + (db[2] - nb[2]) * t) * k];
  }
}
function smooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ---------- shared sprites ----------
let _glow = null;
function glowSprite() {
  if (_glow) return _glow;
  _glow = document.createElement('canvas');
  _glow.width = _glow.height = 128;
  const g = _glow.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(150,168,205,1)');
  grad.addColorStop(0.5, 'rgba(150,168,205,0.28)');
  grad.addColorStop(1, 'rgba(150,168,205,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return _glow;
}

// ---------- grain ----------
const grainTiles = [];
function makeGrain() {
  for (let t = 0; t < 3; t++) {
    const c = document.createElement('canvas');
    c.width = 160; c.height = 160;
    const g = c.getContext('2d');
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 118 + Math.random() * 96;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
      img.data[i + 3] = Math.random() * 34;
    }
    g.putImageData(img, 0, 0);
    grainTiles.push(c);
  }
}

// ============================================================
export function createScene(canvas) {
  const ctx = canvas.getContext('2d');
  if (!grainTiles.length) makeGrain();
  let w = 0, hgt = 0, dpr = 1, vig = null;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    w = r.width; hgt = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hgt * dpr);
  }
  resize();

  // state:
  //  site, terrain (from makeTerrain), eph, sky (siteSky result)
  //  yaw (center azimuth), pitch (center altitude), fov (horizontal deg)
  //  earth: { canvas, homePt } | null,  earthScale, tNow, quality
  function render(st) {
    if (!w || canvas.width === 0) resize();
    if (!w) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ppd = w / st.fov;
    const cx = w / 2, cy = hgt / 2;
    const xOf = (az) => cx + norm180(az - st.yaw) * ppd;
    const yOf = (alt) => cy + (st.pitch - alt) * ppd;
    const sun = st.sky.sun, earth = st.sky.earth;
    const pal = palette(sun.alt, earth.alt);
    const meta = { earthRect: null, sunPt: null };

    // ----- sky -----
    ctx.fillStyle = '#020204';
    ctx.fillRect(0, 0, w, hgt);

    // galactic band (faint, additive) — one pre-rendered sprite, stamped along the plane
    if (pal.starAlpha > 0.25 && st.quality !== 'low') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const g of GALAXY) {
        const aa = projAltAz(st, g.v);
        if (aa.alt < -6) continue;
        const x = xOf(aa.az), y = yOf(aa.alt);
        const rr = ppd * (7 + g.w * 6);
        if (x < -rr || x > w + rr || y < -rr || y > hgt + rr) continue;
        ctx.globalAlpha = 0.05 * g.w * pal.starAlpha;
        ctx.drawImage(glowSprite(), x - rr, y - rr, rr * 2, rr * 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // stars (dimmed near the sun's glare)
    if (pal.starAlpha > 0.02) {
      for (const s of STAR_VECS) {
        const aa = projAltAz(st, s.v);
        if (aa.alt < -1) continue;
        const x = xOf(aa.az), y = yOf(aa.alt);
        if (x < -4 || x > w + 4 || y < -4 || y > hgt + 4) continue;
        let a = pal.starAlpha * Math.min(1, Math.pow(2.512, -s.mag) * 2.4 + 0.18);
        if (sun.alt > -10) {
          const dSun = angDist(aa, sun);
          if (dSun < 42) a *= smooth(9, 42, dSun);
        }
        if (a < 0.015) continue;
        const rr = Math.max(0.55, 1.9 - s.mag * 0.34);
        const [cr, cg, cb] = starColor(s.ci);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(1, a)})`;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.fill();
        if (s.mag < 0.8 && a > 0.5) { // subtle cross bloom on the very brightest
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${a * 0.28})`;
          ctx.fillRect(x - rr * 4, y - 0.5, rr * 8, 1);
          ctx.fillRect(x - 0.5, y - rr * 4, 1, rr * 8);
        }
      }
    }

    // zodiacal light: a tight tilted cone of glow where the sun hides below the horizon
    if (sun.alt < 1.5 && sun.alt > -18) {
      const sx = xOf(sun.az), sy = yOf(Math.max(sun.alt, -1));
      const rr = ppd * 13;
      const a = 0.16 * smooth(-18, -0.5, sun.alt);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1, 1.8); // taller than wide — a cone standing on the horizon
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
      g.addColorStop(0, `rgba(232,220,204,${a})`);
      g.addColorStop(0.45, `rgba(205,196,190,${a * 0.3})`);
      g.addColorStop(1, 'rgba(205,196,190,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-rr, -rr, rr * 2, rr * 2);
      ctx.restore();
    }

    // ----- Earth -----
    if (st.earth && earth.alt > -1.6) {
      const ex = xOf(earth.az), ey = yOf(earth.alt);
      const size = 1.9 * ppd * st.earthScale;      // 1.9deg true angular diameter
      if (ex > -size && ex < w + size && ey > -size && ey < hgt + size) {
        // earthlight halo
        const hr = size * 1.7;
        const halo = ctx.createRadialGradient(ex, ey, size * 0.42, ex, ey, hr);
        halo.addColorStop(0, `rgba(120,158,208,${0.16 * st.eph.earthIllum + 0.04})`);
        halo.addColorStop(1, 'rgba(120,158,208,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(ex - hr, ey - hr, hr * 2, hr * 2);
        ctx.drawImage(st.earth.canvas, ex - size / 2, ey - size / 2, size, size);
        meta.earthRect = { x: ex - size / 2, y: ey - size / 2, size };
        if (st.earth.homePt) {
          const k = size / st.earth.canvas.width;
          meta.homePt = {
            x: ex - size / 2 + st.earth.homePt.x * k,
            y: ey - size / 2 + st.earth.homePt.y * k,
            night: st.earth.homePt.night,
          };
        }
      }
    }

    // ----- sun -----
    if (sun.alt > -1.2) {
      const sx = xOf(sun.az), sy = yOf(sun.alt);
      if (sx > -w * 0.3 && sx < w * 1.3) {
        const core = Math.max(4.5, 0.53 * ppd * 0.62);
        const halo = core * 24;
        let g = ctx.createRadialGradient(sx, sy, 0, sx, sy, halo);
        g.addColorStop(0, 'rgba(255,252,244,0.98)');
        g.addColorStop(0.05, 'rgba(255,246,224,0.72)');
        g.addColorStop(0.16, 'rgba(255,234,196,0.22)');
        g.addColorStop(0.45, 'rgba(255,226,182,0.06)');
        g.addColorStop(1, 'rgba(255,226,182,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - halo, sy - halo, halo * 2, halo * 2);
        // horizontal lens streak
        g = ctx.createLinearGradient(sx - halo * 1.6, sy, sx + halo * 1.6, sy);
        g.addColorStop(0, 'rgba(255,240,214,0)');
        g.addColorStop(0.5, 'rgba(255,242,218,0.34)');
        g.addColorStop(1, 'rgba(255,240,214,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - halo * 1.6, sy - 1.4, halo * 3.2, 2.8);
        // vertical bloom pillar, shorter
        g = ctx.createLinearGradient(sx, sy - halo * 0.5, sx, sy + halo * 0.5);
        g.addColorStop(0, 'rgba(255,240,214,0)');
        g.addColorStop(0.5, 'rgba(255,242,218,0.2)');
        g.addColorStop(1, 'rgba(255,240,214,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - 1.2, sy - halo * 0.5, 2.4, halo);
        ctx.fillStyle = '#FFFDF7';
        ctx.beginPath(); ctx.arc(sx, sy, core, 0, Math.PI * 2); ctx.fill();
        // lens ghosts toward frame center
        const gdx = cx - sx, gdy = cy - sy;
        for (const [t, r0, a0] of [[0.55, core * 0.9, 0.08], [1.15, core * 0.5, 0.06], [1.5, core * 1.4, 0.035]]) {
          ctx.fillStyle = `rgba(200,220,255,${a0})`;
          ctx.beginPath(); ctx.arc(sx + gdx * t, sy + gdy * t, r0, 0, Math.PI * 2); ctx.fill();
        }
        meta.sunPt = { x: sx, y: sy };
      }
    }

    // ----- terrain -----
    const step = Math.max(2, Math.floor(w / (st.quality === 'low' ? 260 : 520)));
    for (let L = 0; L < st.terrain.layers.length; L++) {
      const lay = st.terrain.layers[L];
      const base = pal.bases[L];
      for (let x = 0; x < w + step; x += step) {
        const az = st.yaw + (x - cx) / ppd;
        const alt = lay.p(az);
        const y = yOf(alt);
        // raking light: only flanks tilted toward the sun catch it
        const slope = (lay.p(az + 1.0) - lay.p(az - 1.0)) / 2.0;
        const d = norm180(sun.az - az);
        const facing = clamp01(-slope * Math.sign(d) * 2.2) * clamp01(Math.abs(d) / 14);
        const sunUp = smooth(-0.6, 0.8, sun.alt);
        const rake = facing * (pal.grazing * 1.5 + pal.dayF * 0.5) * sunUp;
        // flat-lit component in full day (sun high hits everything)
        const flat = pal.dayF * smooth(6, 40, sun.alt) * 0.35;
        // earthshine rake at night
        const de = norm180(earth.az - az);
        const erake = earth.alt > 0
          ? clamp01(-slope * Math.sign(de) * 1.6) * pal.earthlit * (1 - pal.dayF) * st.eph.earthIllum
          : 0;
        let r = base[0] * (1 + flat) + pal.rim[0] * rake * 0.85 + 46 * erake;
        let gg = base[1] * (1 + flat) + pal.rim[1] * rake * 0.8 + 56 * erake;
        let b = base[2] * (1 + flat) + pal.rim[2] * rake * 0.72 + 78 * erake;
        ctx.fillStyle = `rgb(${Math.min(255, r) | 0},${Math.min(255, gg) | 0},${Math.min(255, b) | 0})`;
        ctx.fillRect(x - step, y, step + 1, hgt - y + 1);
      }
      // crisp lit edge along the ridgeline when the sun grazes
      if (pal.grazing * smooth(-0.6, 0.5, sun.alt) > 0.08) {
        ctx.beginPath();
        let started = false;
        for (let x = 0; x <= w; x += step) {
          const az = st.yaw + (x - cx) / ppd;
          const y = yOf(lay.p(az));
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = css(pal.rim, 0.10 * pal.grazing);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // ----- foreground ground plane -----
    const nearBaseAlt = -st.terrain.amp * 0.28 - 0.55;
    const gy = yOf(nearBaseAlt);
    if (gy < hgt) {
      const g = ctx.createLinearGradient(0, gy, 0, hgt);
      g.addColorStop(0, css(pal.groundTop));
      g.addColorStop(1, css(pal.groundBot));
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.max(0, gy), w, hgt);
      // craterlets: shadowed dimples stippled across the regolith by day
      if (pal.dayF > 0.03) {
        const sunUpC = pal.dayF;
        const shadowSide = Math.sign(norm180(sun.az - st.yaw) || 1);
        for (let k = 0; k < 64; k++) {
          const caz = h1(k, st.site.seed + 31) * 360;
          const drop = 0.7 + Math.pow(h1(k, st.site.seed + 32), 1.4) * 8.6;
          const x = xOf(caz), y = yOf(nearBaseAlt - drop);
          if (x < -40 || x > w + 40 || y < gy + 3 || y > hgt + 30) continue;
          const persp = 1 + drop * 0.5;
          const cw = (0.10 + h1(k, st.site.seed + 33) * 0.5) * ppd * persp;
          const ch = cw * 0.26;
          ctx.fillStyle = `rgba(2,2,3,${0.34 * sunUpC})`;
          ctx.beginPath();
          ctx.ellipse(x - shadowSide * cw * 0.14, y, cw * 0.72, ch, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = css(pal.rim, 0.13 * sunUpC);
          ctx.beginPath();
          ctx.ellipse(x + shadowSide * cw * 0.4, y + ch * 0.5, cw * 0.5, ch * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // rocks & their long shadows — quiet at night, crisp by day
    const sunUpG = smooth(-0.4, 1.2, sun.alt);
    for (const rock of st.terrain.rocks) {
      const alt = nearBaseAlt - rock.drop;
      const x = xOf(rock.az), y = yOf(alt);
      if (y < gy + 2 || x < -60 || x > w + 60 || y > hgt + 60) continue;
      const persp = 1 + rock.drop * 0.55;                    // closer rocks look bigger
      const rw = rock.size * ppd * persp, rh = rw * (0.55 + rock.tone * 0.25);
      const dSun = norm180(sun.az - az0(st, x));
      if (sunUpG > 0.05) {
        const shLen = Math.min(rw * 16, rw * (1.4 / Math.tan(Math.max(2.2, sun.alt) * RAD)));
        const dir = -Math.sign(dSun || 1);                   // shadow points away from the sun
        const g = ctx.createLinearGradient(x, y, x + dir * (shLen + rw), y);
        g.addColorStop(0, `rgba(1,1,2,${0.7 * sunUpG})`);
        g.addColorStop(1, 'rgba(1,1,2,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x + dir * shLen * 0.5, y + rh * 0.32, shLen * 0.55 + rw * 0.5, rh * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const t = pal.groundTop;
      // slightly darker than the soil, with a sun-side rim highlight added after
      const lit = 0.6 + rock.tone * 0.25 + sunUpG * 0.28;
      ctx.fillStyle = `rgb(${Math.min(255, t[0] * lit) | 0},${Math.min(255, t[1] * lit) | 0},${Math.min(255, t[2] * lit) | 0})`;
      ctx.beginPath();
      // irregular pentagon reads as rock better than an ellipse
      ctx.moveTo(x - rw, y + rh * 0.3);
      ctx.lineTo(x - rw * (0.3 + rock.tone * 0.3), y - rh);
      ctx.lineTo(x + rw * (0.5 - rock.tone * 0.2), y - rh * (0.6 + rock.tone * 0.4));
      ctx.lineTo(x + rw, y + rh * 0.2);
      ctx.lineTo(x + rw * 0.2, y + rh * 0.5);
      ctx.closePath();
      ctx.fill();
      if (sunUpG > 0.1) { // bright rim on the sunward edge
        ctx.strokeStyle = css(pal.rim, 0.35 * sunUpG);
        ctx.lineWidth = 1;
        ctx.beginPath();
        const sgn = Math.sign(dSun || 1);
        ctx.moveTo(x + sgn * rw * 0.85, y + rh * 0.22);
        ctx.lineTo(x + sgn * rw * (0.3 - rock.tone * 0.15), y - rh * 0.92);
        ctx.stroke();
      }
    }

    // ----- site artifact silhouette -----
    if (st.site.artifact) drawArtifact(ctx, st, xOf, yOf, pal);

    // ----- home marker over the Earth -----
    if (meta.homePt) {
      const p = meta.homePt;
      const pulse = 0.5 + 0.5 * Math.sin(st.tNow / 700);
      ctx.strokeStyle = `rgba(255,214,140,${0.5 + 0.4 * pulse})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.2 + pulse * 2.4, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,224,170,0.95)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2); ctx.fill();
    }

    // ----- vignette (cached) + grain -----
    if (!vig || vig.width !== Math.round(w) || vig.height !== Math.round(hgt)) {
      vig = document.createElement('canvas');
      vig.width = Math.round(w); vig.height = Math.round(hgt);
      const vg = vig.getContext('2d');
      const v = vg.createRadialGradient(cx, cy * 0.9, Math.min(w, hgt) * 0.44, cx, cy, Math.max(w, hgt) * 0.78);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.42)');
      vg.fillStyle = v;
      vg.fillRect(0, 0, vig.width, vig.height);
    }
    ctx.drawImage(vig, 0, 0, w, hgt);
    if (st.grain !== false) {
      const tile = grainTiles[Math.floor(st.tNow / 90) % 3];
      ctx.globalAlpha = 0.5;
      ctx.save();
      ctx.translate((st.tNow / 40) % 160, 0);
      const pat = ctx.createPattern(tile, 'repeat');
      ctx.fillStyle = pat;
      ctx.fillRect(-160, 0, w + 320, hgt);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    return meta;
  }

  function az0(st, x) {
    const ppd = w / st.fov;
    return st.yaw + (x - w / 2) / ppd;
  }

  return { render, resize, size: () => ({ w, h: hgt }) };
}

// alt/az of an ecliptic unit vector for the current site frame
function projAltAz(st, v) {
  const f = st.sky.frame;
  const alt = Math.asin(clamp1(v[0] * f.zenith[0] + v[1] * f.zenith[1] + v[2] * f.zenith[2])) / RAD;
  const az = Math.atan2(
    v[0] * f.east[0] + v[1] * f.east[1] + v[2] * f.east[2],
    v[0] * f.north[0] + v[1] * f.north[1] + v[2] * f.north[2]
  ) / RAD;
  return { alt, az: ((az % 360) + 360) % 360 };
}
function clamp1(x) { return Math.max(-1, Math.min(1, x)); }
function angDist(a, b) {
  const d1 = (a.alt - b.alt);
  const d2 = norm180(a.az - b.az) * Math.cos(((a.alt + b.alt) / 2) * RAD);
  return Math.hypot(d1, d2);
}

function drawArtifact(ctx, st, xOf, yOf, pal) {
  const site = st.site;
  const az = site.artifactAz;
  const layer = st.terrain.layers[1];
  const baseAlt = layer.p(az);
  const x = xOf(az), y = yOf(baseAlt);
  const dark = 'rgba(8,9,11,0.92)';
  const rimA = Math.max(pal.dayF, pal.grazing * 1.2, pal.earthlit * 0.5);
  ctx.save();
  ctx.translate(x, y);
  if (site.artifact === 'mast') {
    ctx.strokeStyle = dark; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -46); ctx.stroke();
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(-14, 0); ctx.moveTo(0, -46); ctx.lineTo(14, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, -34); ctx.lineTo(9, -34); ctx.stroke();
    const blink = Math.sin(st.tNow / 900) > 0.65;
    ctx.fillStyle = blink ? 'rgba(255,92,80,0.95)' : 'rgba(120,40,36,0.5)';
    ctx.beginPath(); ctx.arc(0, -48, 2, 0, Math.PI * 2); ctx.fill();
  } else if (site.artifact === 'lander') {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-13, -10); ctx.lineTo(13, -10); ctx.lineTo(9, -22); ctx.lineTo(-9, -22); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-11, -10); ctx.lineTo(-17, 0); ctx.moveTo(11, -10); ctx.lineTo(17, 0);
    ctx.moveTo(-5, -10); ctx.lineTo(-7, 0); ctx.moveTo(5, -10); ctx.lineTo(7, 0);
    ctx.stroke();
    if (rimA > 0.1) {
      ctx.strokeStyle = `rgba(${pal.rim[0]},${pal.rim[1]},${pal.rim[2]},${rimA * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-13, -10); ctx.lineTo(13, -10); ctx.stroke();
    }
  } else if (site.artifact === 'dish') {
    ctx.strokeStyle = dark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -18); ctx.stroke();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(0, -26, 13, 9, -0.5, 0, Math.PI * 2); ctx.fill();
    if (rimA > 0.1) {
      ctx.strokeStyle = `rgba(${pal.rim[0]},${pal.rim[1]},${pal.rim[2]},${rimA * 0.55})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, -26, 13, 9, -0.5, -0.6, 2.2); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------- dock thumbnails ----------
export function renderThumb(canvas, site, terrain, sky) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const pal = palette(sky.sun.alt, sky.earth.alt);
  ctx.fillStyle = '#030305';
  ctx.fillRect(0, 0, w, h);
  // a few deterministic stars
  if (pal.starAlpha > 0.1) {
    for (let i = 0; i < 26; i++) {
      const x = h1(i, site.seed + 20) * w, y = h1(i, site.seed + 21) * h * 0.62;
      ctx.fillStyle = `rgba(220,230,250,${0.25 + h1(i, 3) * 0.5 * pal.starAlpha})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // sun / earth glyphs
  const yawc = site.yaw;
  const ppd = w / 110;
  const xg = (az) => w / 2 + norm180(az - yawc) * ppd;
  if (sky.earth.alt > -2) {
    const ex = xg(sky.earth.az), ey = h * 0.62 - sky.earth.alt * (h / 70);
    if (ex > -6 && ex < w + 6 && ey > -6) {
      ctx.fillStyle = '#6FA0CE';
      ctx.beginPath(); ctx.arc(ex, Math.max(5, ey), 3.2, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (sky.sun.alt > -1) {
    const sx = xg(sky.sun.az), sy = h * 0.62 - sky.sun.alt * (h / 70);
    if (sx > -8 && sx < w + 8 && sy > -8) {
      const g = ctx.createRadialGradient(sx, Math.max(4, sy), 0, sx, Math.max(4, sy), 9);
      g.addColorStop(0, 'rgba(255,250,238,0.95)'); g.addColorStop(1, 'rgba(255,250,238,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 9, Math.max(4, sy) - 9, 18, 18);
    }
  }
  // horizon silhouette
  const base = pal.bases[1];
  ctx.fillStyle = css(base);
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 3) {
    const az = yawc + (x - w / 2) / ppd;
    const alt = terrain.layers[0].p(az);
    ctx.lineTo(x, h * 0.62 - alt * (h / 70));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}
