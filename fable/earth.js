// LunarCams Fable — the Earth disc, as actually seen from the Moon right now.
// Per-pixel orthographic render of the hemisphere facing the Moon: real land
// mask, real terminator, procedural clouds, city lights on the night side.

import { MASK_W, MASK_H, LANDMASK_B64 } from './data.js';

const RAD = Math.PI / 180;

// ---------- land mask ----------
const maskBits = (() => {
  const bin = atob(LANDMASK_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
})();
function landAt(latDeg, lonDeg) {
  // bilinear-ish soft sample: average the 1-degree cell and its neighbors
  const r = Math.min(MASK_H - 1, Math.max(0, Math.round(89.5 - latDeg)));
  const c = ((Math.round(lonDeg + 179.5) % MASK_W) + MASK_W) % MASK_W;
  const idx = r * MASK_W + c;
  return (maskBits[idx >> 3] >> (idx & 7)) & 1;
}
function landSoft(latDeg, lonDeg) {
  let s = 0;
  s += landAt(latDeg, lonDeg) * 2;
  s += landAt(latDeg + 0.7, lonDeg) + landAt(latDeg - 0.7, lonDeg);
  s += landAt(latDeg, lonDeg + 0.7) + landAt(latDeg, lonDeg - 0.7);
  return s / 6;
}

// ---------- tiny deterministic noise ----------
function hash2(x, y) {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  return 0.55 * vnoise(x, y) + 0.28 * vnoise(x * 2.13, y * 2.13) + 0.17 * vnoise(x * 4.7, y * 4.7);
}

const V = (lat, lon) => [
  Math.cos(lat * RAD) * Math.cos(lon * RAD),
  Math.cos(lat * RAD) * Math.sin(lon * RAD),
  Math.sin(lat * RAD),
];

// Renders the disc into its own canvas. view = {
//   subLat, subLon   : sub-lunar point on Earth (the hemisphere we see)
//   sunLat, sunLon   : sub-solar point on Earth (drives the terminator)
//   northAngle       : screen rotation of Earth's north, degrees (CW positive)
//   cloudT           : slow time value for cloud drift
//   home             : optional {lat, lon} to project (returned, not drawn)
// }
export function createEarthRenderer() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let lastKey = '';

  function render(size, view) {
    const key = [size, view.subLat.toFixed(2), view.subLon.toFixed(2), view.sunLat.toFixed(2),
      view.sunLon.toFixed(2), view.northAngle.toFixed(1), Math.round(view.cloudT)].join('|');
    let homePt = projectHome(size, view);
    if (key === lastKey) return { canvas, homePt };
    lastKey = key;

    canvas.width = size; canvas.height = size;
    const img = ctx.createImageData(size, size);
    const px = img.data;

    const C = V(view.subLat, view.subLon);
    const N = [-Math.sin(view.subLat * RAD) * Math.cos(view.subLon * RAD),
               -Math.sin(view.subLat * RAD) * Math.sin(view.subLon * RAD),
                Math.cos(view.subLat * RAD)];
    const E = [-Math.sin(view.subLon * RAD), Math.cos(view.subLon * RAD), 0];
    const S = V(view.sunLat, view.sunLon);
    // half-vector for ocean specular
    let H = [C[0] + S[0], C[1] + S[1], C[2] + S[2]];
    const hl = Math.hypot(H[0], H[1], H[2]) || 1;
    H = [H[0] / hl, H[1] / hl, H[2] / hl];

    const rot = -view.northAngle * RAD;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const half = size / 2;
    const cloudShift = view.cloudT * 0.03;

    for (let j = 0; j < size; j++) {
      const pyr = (j - half) / (half * 0.985);
      for (let i = 0; i < size; i++) {
        const pxr = (i - half) / (half * 0.985);
        const rr = pxr * pxr + pyr * pyr;
        const o = (j * size + i) * 4;
        if (rr > 1) { px[o + 3] = 0; continue; }
        // rotate screen coords so north is "up" in the sampling frame
        const vx = pxr * cr - (-pyr) * sr;   // screen y grows downward; flip to math-up
        const vy = pxr * sr + (-pyr) * cr;
        const vz = Math.sqrt(Math.max(0, 1 - rr));
        // point on the globe, earth-fixed
        const P = [
          vz * C[0] + vx * E[0] + vy * N[0],
          vz * C[1] + vx * E[1] + vy * N[1],
          vz * C[2] + vx * E[2] + vy * N[2],
        ];
        const lat = Math.asin(Math.max(-1, Math.min(1, P[2]))) / RAD;
        const lon = Math.atan2(P[1], P[0]) / RAD;

        const land = landSoft(lat, lon);
        const day = P[0] * S[0] + P[1] * S[1] + P[2] * S[2];   // cos of sun zenith angle
        const dayF = smooth(-0.03, 0.18, day);                  // 0 night -> 1 day

        // base surface color
        let r, g, b;
        if (land > 0.34) {
          // land: latitude-banded tans and greens, polar ice
          const n = vnoise(lon * 0.11 + 31, lat * 0.11 - 7);
          const desert = Math.exp(-Math.pow((Math.abs(lat) - 23) / 14, 2)) * (0.55 + 0.45 * n);
          const alat = Math.abs(lat);
          if (alat > 63 + n * 8) { r = 232; g = 238; b = 244; }          // ice & tundra
          else {
            const gr = [104, 128, 74], ds = [198, 168, 106];
            r = gr[0] + (ds[0] - gr[0]) * desert;
            g = gr[1] + (ds[1] - gr[1]) * desert;
            b = gr[2] + (ds[2] - gr[2]) * desert;
            const shade = 0.86 + 0.3 * n;
            r *= shade; g *= shade; b *= shade;
          }
        } else {
          // ocean, with polar sea ice
          if (Math.abs(lat) > 71) { r = 222; g = 230; b = 238; }
          else {
            const deep = 0.78 + 0.22 * vnoise(lon * 0.07, lat * 0.07);
            r = 22 * deep; g = 74 * deep; b = 152 * deep;
            // specular glint
            const spec = Math.pow(Math.max(0, P[0] * H[0] + P[1] * H[1] + P[2] * H[2]), 70);
            r += spec * 185; g += spec * 195; b += spec * 200;
          }
        }

        // clouds (drift slowly westward; denser at ITCZ and mid-lat storm tracks)
        const bandW = 0.5 + 0.5 * (
          Math.exp(-Math.pow(lat / 11, 2)) * 0.9 +
          Math.exp(-Math.pow((Math.abs(lat) - 48) / 16, 2))
        );
        let cl = fbm(lon * 0.028 + cloudShift, lat * 0.031 + Math.sin(cloudShift * 0.6) * 0.3);
        cl = smooth(0.48, 0.78, cl * bandW * 1.3);
        r = r + (252 - r) * cl * 0.9;
        g = g + (253 - g) * cl * 0.9;
        b = b + (254 - b) * cl * 0.9;

        // day/night mix
        const nightR = r * 0.045 + 4, nightG = g * 0.05 + 6, nightB = b * 0.06 + 12;
        r = nightR + (r - nightR) * dayF;
        g = nightG + (g - nightG) * dayF;
        b = nightB + (b - nightB) * dayF;

        // terminator warmth: a faint amber band right at the edge of night
        const tw = Math.exp(-Math.pow((day - 0.03) / 0.05, 2)) * 0.25;
        r += 70 * tw; g += 38 * tw;

        // city lights on the night side — warm clusters along populated latitudes
        if (dayF < 0.35 && land > 0.3 && cl < 0.5) {
          const cityBand = Math.exp(-Math.pow((lat - 34) / 26, 2)) + 0.55 * Math.exp(-Math.pow((lat + 22) / 20, 2));
          const cell = hash2(Math.round(lon * 1.6), Math.round(lat * 1.6));           // metro cluster
          const spark = hash2(Math.round(lon * 5) + 7, Math.round(lat * 5));          // texture inside it
          const glow = smooth(0.6, 0.95, cell * (0.5 + cityBand * 0.7)) * (0.3 + 0.7 * spark);
          if (glow > 0.02) {
            const amp = (1 - dayF / 0.35) * glow;
            r += 210 * amp; g += 142 * amp; b += 52 * amp;
          }
        }

        // limb shading (atmosphere thickening toward the edge)
        const limb = Math.pow(vz, 0.38);
        r *= 0.35 + 0.65 * limb; g *= 0.35 + 0.65 * limb; b *= 0.38 + 0.62 * limb;
        // blue atmospheric haze at the limb, on the day side
        const haze = (1 - limb) * (0.25 + 0.75 * dayF);
        r += 38 * haze; g += 70 * haze; b += 130 * haze;

        px[o] = Math.min(255, r);
        px[o + 1] = Math.min(255, g);
        px[o + 2] = Math.min(255, b);
        // soft anti-aliased rim
        px[o + 3] = rr > 0.94 ? Math.round(255 * smooth(1.0, 0.94, rr)) : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    homePt = projectHome(size, view);
    return { canvas, homePt };
  }

  // Where does a home lat/lon fall on the disc? null if on the far hemisphere.
  function projectHome(size, view) {
    if (!view.home) return null;
    const C = V(view.subLat, view.subLon);
    const N = [-Math.sin(view.subLat * RAD) * Math.cos(view.subLon * RAD),
               -Math.sin(view.subLat * RAD) * Math.sin(view.subLon * RAD),
                Math.cos(view.subLat * RAD)];
    const E = [-Math.sin(view.subLon * RAD), Math.cos(view.subLon * RAD), 0];
    const Hv = V(view.home.lat, view.home.lon);
    const hz = Hv[0] * C[0] + Hv[1] * C[1] + Hv[2] * C[2];
    if (hz <= 0.02) return null;
    const hx = Hv[0] * E[0] + Hv[1] * E[1] + Hv[2] * E[2];
    const hy = Hv[0] * N[0] + Hv[1] * N[1] + Hv[2] * N[2];
    const rot = view.northAngle * RAD;      // inverse of the sampling rotation
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const sx = hx * cr - hy * sr;
    const sy = hx * sr + hy * cr;
    const half = size / 2;
    // night-side? (for marker styling)
    const S = V(view.sunLat, view.sunLon);
    const litDot = Hv[0] * S[0] + Hv[1] * S[1] + Hv[2] * S[2];
    return { x: half + sx * half * 0.985, y: half - sy * half * 0.985, night: litDot < 0 };
  }

  return { render };
}

function smooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
