// LunarCams Fable — ephemeris engine.
// Low-precision Sun/Moon astronomy (truncated Meeus series, arcminute-class),
// good enough that every sky in the app is the real sky for the chosen instant.
// Frame: geocentric ecliptic of date. x -> vernal equinox, z -> ecliptic north.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
export const SYNODIC_DAYS = 29.530588;
const DAY_MS = 86400000;

export function julianDay(ms) { return ms / DAY_MS + 2440587.5; }
function centuries(jd) { return (jd - 2451545.0) / 36525; }
function norm360(x) { x %= 360; return x < 0 ? x + 360 : x; }
const sin = (d) => Math.sin(d * RAD);
const cos = (d) => Math.cos(d * RAD);

// ---------- vectors ----------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function fromLatLon(latDeg, lonDeg) {
  return [cos(latDeg) * cos(lonDeg), cos(latDeg) * sin(lonDeg), sin(latDeg)];
}

// ---------- sun (geocentric, Meeus ch. 25) ----------
function sunEclipticLongitude(T) {
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M)
    + (0.019993 - 0.000101 * T) * sin(2 * M)
    + 0.000289 * sin(3 * M);
  return norm360(L0 + C);
}

// ---------- moon (geocentric, truncated Meeus ch. 47) ----------
function moonEcliptic(T) {
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T);
  const D = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T);
  const M = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T);
  const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T);
  const F = norm360(93.272095 + 483202.0175233 * T - 0.0036539 * T * T);
  const lon = Lp
    + 6.288774 * sin(Mp) + 1.274027 * sin(2 * D - Mp) + 0.658314 * sin(2 * D)
    + 0.213618 * sin(2 * Mp) - 0.185116 * sin(M) - 0.114332 * sin(2 * F)
    + 0.058793 * sin(2 * D - 2 * Mp) + 0.057066 * sin(2 * D - M - Mp)
    + 0.053322 * sin(2 * D + Mp) + 0.045758 * sin(2 * D - M)
    - 0.040923 * sin(M - Mp) - 0.03472 * sin(D) - 0.030383 * sin(M + Mp);
  const lat = 5.128122 * sin(F) + 0.280602 * sin(Mp + F) + 0.277693 * sin(Mp - F)
    + 0.173237 * sin(2 * D - F) + 0.055413 * sin(2 * D - Mp + F) + 0.046271 * sin(2 * D - Mp - F)
    + 0.032573 * sin(2 * D + F) + 0.017198 * sin(2 * Mp + F);
  const dist = 385000.56
    - 20905.355 * cos(Mp) - 3699.111 * cos(2 * D - Mp) - 2955.968 * cos(2 * D)
    - 569.925 * cos(2 * Mp) + 48.888 * cos(M) - 3.149 * cos(2 * F)
    + 246.158 * cos(2 * D - 2 * Mp) - 152.138 * cos(2 * D - M - Mp) - 170.733 * cos(2 * D + Mp);
  return { lon: norm360(lon), lat, dist };
}

// ---------- earth rotation ----------
function gmstDeg(jd) {
  const T = centuries(jd);
  return norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T);
}
function obliquityDeg(T) { return 23.4392911 - 0.0130042 * T; }

// Convert an ecliptic unit vector to equatorial RA/dec (degrees).
function eclipticVecToRaDec(v, eps) {
  const x = v[0];
  const y = v[1] * cos(eps) - v[2] * sin(eps);
  const z = v[1] * sin(eps) + v[2] * cos(eps);
  return { ra: norm360(Math.atan2(y, x) * DEG), dec: Math.asin(Math.max(-1, Math.min(1, z))) * DEG };
}
// Equatorial RA/dec (degrees) -> ecliptic unit vector.
export function raDecToEclipticVec(raDeg, decDeg, eps = 23.4392911) {
  const xq = cos(decDeg) * cos(raDeg);
  const yq = cos(decDeg) * sin(raDeg);
  const zq = sin(decDeg);
  return [xq, yq * cos(eps) + zq * sin(eps), -yq * sin(eps) + zq * cos(eps)];
}

// ---------- the full state for one instant ----------
export function ephemeris(ms) {
  const jd = julianDay(ms);
  const T = centuries(jd);
  const eps = obliquityDeg(T);

  const sunLon = sunEclipticLongitude(T);
  const moon = moonEcliptic(T);

  // unit directions in the ecliptic frame
  const moonDir = fromLatLon(moon.lat, moon.lon);        // earth -> moon
  const earthFromMoon = scale(moonDir, -1);              // moon -> earth
  const sunFromEarth = fromLatLon(0, sunLon);            // earth -> sun
  // moon -> sun: sun is ~389x farther than the moon; include the tiny parallax
  const sunFromMoon = norm(sub(scale(sunFromEarth, 389), moonDir));

  // phase: elongation of moon from sun (0 = new moon, 180 = full moon)
  const elong = Math.acos(Math.max(-1, Math.min(1, dot(moonDir, sunFromEarth)))) * DEG;
  // waxing if the moon sits east of the sun (ecliptic longitudes)
  const waxing = norm360(moon.lon - sunLon) < 180;
  const moonIllum = (1 - cos(elong)) / 2;               // fraction lit, seen from Earth
  const earthIllum = (1 + cos(elong)) / 2;              // fraction lit, seen from the Moon
  const moonAgeDays = (waxing ? elong : 360 - elong) / 360 * SYNODIC_DAYS;

  // where earth's own globe points: sub-lunar & sub-solar lat/lon on Earth
  const gmst = gmstDeg(jd);
  const moonEq = eclipticVecToRaDec(moonDir, eps);
  const sunEq = eclipticVecToRaDec(sunFromEarth, eps);
  const subLunar = { lat: moonEq.dec, lon: norm180(moonEq.ra - gmst) };
  const subSolar = { lat: sunEq.dec, lon: norm180(sunEq.ra - gmst) };

  // Earth's north pole as an ecliptic vector: equatorial [0,0,1] -> [0, sin eps, cos eps]
  const earthPole = [0, sin(eps), cos(eps)];

  return {
    ms, jd, T, eps, sunLon,
    moonLon: moon.lon, moonLat: moon.lat, moonDist: moon.dist,
    moonDir, earthFromMoon, sunFromMoon, sunFromEarth,
    elong, waxing, moonIllum, earthIllum,
    moonAgeDays, gmst, subLunar, subSolar, earthPole,
    // lunation progress 0..1 (0 = new moon)
    lunation: moonAgeDays / SYNODIC_DAYS,
  };
}

export function norm180(x) { x = norm360(x); return x > 180 ? x - 360 : x; }

// ---------- a site on the moon ----------
// The moon is tidally locked: selenographic lon 0 faces Earth (we anchor the
// prime meridian to the instantaneous Earth direction, absorbing libration).
// Moon's spin axis is within 1.54 deg of the ecliptic pole; we use the pole.
export function siteFrame(eph, latDeg, lonDeg) {
  const zAxis = [0, 0, 1];
  const xAxis = norm([eph.earthFromMoon[0], eph.earthFromMoon[1], 0]); // lon 0 on the lunar equator
  const yAxis = cross(zAxis, xAxis);                                   // +lon east
  const zenith = add(
    scale(add(scale(xAxis, cos(lonDeg)), scale(yAxis, sin(lonDeg))), cos(latDeg)),
    scale(zAxis, sin(latDeg))
  );
  const north = norm(sub(zAxis, scale(zenith, dot(zAxis, zenith))));
  const east = cross(north, zenith);
  return { zenith, north, east };
}

// Alt/az (degrees) of any ecliptic-frame unit direction, from a site frame.
export function altAz(frame, dir) {
  const alt = Math.asin(Math.max(-1, Math.min(1, dot(dir, frame.zenith)))) * DEG;
  const az = norm360(Math.atan2(dot(dir, frame.east), dot(dir, frame.north)) * DEG);
  return { alt, az };
}

// Everything a "window" needs for one site at one instant.
export function siteSky(eph, site) {
  const frame = siteFrame(eph, site.lat, site.lon);
  const sun = altAz(frame, eph.sunFromMoon);
  const earth = altAz(frame, eph.earthFromMoon);
  // position angle of Earth's north pole on the sky view (for disc orientation):
  // screen-up at the earth's sky position is the direction of increasing altitude.
  const e = eph.earthFromMoon;
  const up = norm(sub(frame.zenith, scale(e, dot(frame.zenith, e))));
  const right = cross(up, e);
  const pole = eph.earthPole;
  const northAngle = Math.atan2(dot(pole, right), dot(pole, up)) * DEG;
  // crude but honest surface temperature model (regolith swings, kelvin -> C)
  const sunAlt = sun.alt;
  const tempC = sunAlt > 0
    ? Math.round(-60 + 190 * Math.pow(Math.max(0, sin(sunAlt)), 0.6) - Math.abs(site.lat) * 0.4)
    : Math.round(-150 - 30 * Math.min(1, -sunAlt / 12) - Math.abs(site.lat) * 0.2);
  return { frame, sun, earth, northAngle, tempC };
}

// Solar elevation only — cheap, for event scanning.
export function sunAltAt(ms, site) {
  const eph = ephemeris(ms);
  return altAz(siteFrame(eph, site.lat, site.lon), eph.sunFromMoon).alt;
}

// ---------- event scanning ----------
// Find the next time f crosses zero (rising if dir>0) between start and start+spanDays.
function scanCrossing(f, startMs, spanDays, dir, stepH = 2) {
  const step = stepH * 3600000;
  let prev = f(startMs);
  for (let t = startMs + step; t <= startMs + spanDays * DAY_MS; t += step) {
    const cur = f(t);
    if ((dir > 0 && prev < 0 && cur >= 0) || (dir < 0 && prev > 0 && cur <= 0)) {
      // bisect
      let lo = t - step, hi = t;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const v = f(mid);
        if ((dir > 0 && v < 0) || (dir < 0 && v > 0)) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    }
    prev = cur;
  }
  return null;
}

export function nextSunrise(ms, site) { return scanCrossing((t) => sunAltAt(t, site), ms, 32, +1); }
export function nextSunset(ms, site) { return scanCrossing((t) => sunAltAt(t, site), ms, 32, -1); }
export function nextFullMoon(ms) {
  // maximize elongation: scan for elong-179.2 rising crossing is unstable at the cusp,
  // so find the minimum of (180 - elong) by coarse scan + refine.
  let best = null, bestV = 1e9;
  for (let t = ms; t <= ms + 31 * DAY_MS; t += 3600000) {
    const v = 180 - ephemeris(t).elong;
    if (v < bestV) { bestV = v; best = t; }
  }
  let lo = best - 3600000, hi = best + 3600000;
  for (let i = 0; i < 30; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (180 - ephemeris(m1).elong < 180 - ephemeris(m2).elong) hi = m2; else lo = m1;
  }
  return (lo + hi) / 2;
}
export function nextNewMoon(ms) {
  let best = null, bestV = 1e9;
  for (let t = ms; t <= ms + 31 * DAY_MS; t += 3600000) {
    const v = ephemeris(t).elong;
    if (v < bestV) { bestV = v; best = t; }
  }
  let lo = best - 3600000, hi = best + 3600000;
  for (let i = 0; i < 30; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (ephemeris(m1).elong < ephemeris(m2).elong) hi = m2; else lo = m1;
  }
  return (lo + hi) / 2;
}

// A given Earth location faces the moon once per ~24.84h (lunar day on Earth).
// Returns { deg, facingNow, nextCenterMs }: deg is the current signed offset of
// home from the sub-lunar meridian; nextCenterMs is when that offset next hits 0.
export function homeFacing(ms, homeLonDeg) {
  const offsetAt = (t) => norm180(ephemeris(t).subLunar.lon - homeLonDeg);
  const deg = offsetAt(ms);
  // The sub-lunar point sweeps westward: the offset decreases ~360deg per 24.84h.
  const ratePerMs = 360 / (24.8412 * 3600000);
  let t = ms + (((deg % 360) + 360) % 360) / ratePerMs; // forward to the next zero
  for (let i = 0; i < 5; i++) {
    const d = offsetAt(t);
    if (Math.abs(d) < 0.02) break;
    t += d / ratePerMs;
  }
  return { deg, facingNow: Math.abs(deg) < 60, nextCenterMs: t };
}

// Brown lunation number (approx): lunation 1 began 1923-01-16.
export function lunationNumber(ms) {
  return Math.floor((julianDay(ms) - 2423436.6115277777) / SYNODIC_DAYS) + 1;
}
