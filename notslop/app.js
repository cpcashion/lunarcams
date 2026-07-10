// LunarCams — Lunar Cartography Desk ("notslop" alternate build)
// Vanilla JS, no build step. Reuses the same live data sources as the
// standard build: NASA Images API, Launch Library 2, and the camera roster.

const LOCATIONS = [
  { id: `LC-01`, name: `Tycho Crater`, region: `Southern Highlands`, lat: -43.31, lon: -11.36, altBase: 112, altSpread: 6, signalBase: -68, tempBase: -41, res: `4K`, fps: 24, status: `live`, img: `https://images.unsplash.com/photo-1777277539221-47622b964573?fm=jpg&q=70&w=1200&auto=format&fit=crop` },
  { id: `LC-02`, name: `Sea of Tranquility`, region: `Mare Tranquillitatis`, lat: 8.5, lon: 31.4, altBase: 98, altSpread: 5, signalBase: -64, tempBase: -18, res: `4K`, fps: 30, status: `live`, img: `https://images.unsplash.com/photo-1447433589675-4aaa569f3e05?fm=jpg&q=70&w=1200&auto=format&fit=crop` },
  { id: `LC-03`, name: `Copernicus Crater`, region: `Mare Insularum`, lat: 9.7, lon: -20, altBase: 105, altSpread: 7, signalBase: -70, tempBase: -23, res: `4K`, fps: 24, status: `live`, img: `https://images.unsplash.com/photo-1777276516205-ec88d271e9b9?fm=jpg&q=70&w=1200&auto=format&fit=crop` },
  { id: `LC-04`, name: `Mare Imbrium`, region: `Sea of Rains`, lat: 32.8, lon: -15.6, altBase: 121, altSpread: 6, signalBase: -66, tempBase: -29, res: `2K`, fps: 18, status: `live`, img: `https://images.unsplash.com/photo-1777277539243-17e4f2c41aaa?fm=jpg&q=70&w=1200&auto=format&fit=crop` },
  { id: `LC-05`, name: `Oceanus Procellarum`, region: `Ocean of Storms`, lat: 18.4, lon: -57.4, altBase: 116, altSpread: 8, signalBase: -72, tempBase: -33, res: `2K`, fps: 18, status: `live`, img: `https://images.unsplash.com/photo-1777276516260-3a87c1e42db4?fm=jpg&q=70&w=1200&auto=format&fit=crop` },
  { id: `LC-06`, name: `Mare Serenitatis`, region: `Sea of Serenity`, lat: 28, lon: 17.5, altBase: 103, altSpread: 5, signalBase: -67, tempBase: -21, res: `4K`, fps: 24, status: `live`, img: `https://images.unsplash.com/photo-1765368273930-0bbaf545e822?fm=jpg&q=70&w=1200&auto=format&fit=crop` },
  { id: `LC-07`, name: `Plato Crater`, region: `Northern Mare Imbrium`, lat: 51.6, lon: -9.3, altBase: 128, altSpread: 7, signalBase: -73, tempBase: -38, res: `2K`, fps: 15, status: `sun-glare`, img: `https://images.unsplash.com/photo-1777277539432-5bcb463a55e2?fm=jpg&q=70&w=1200&auto=format&fit=crop` },
  { id: `LC-08`, name: `Aristarchus Plateau`, region: `Oceanus Procellarum`, lat: 23.7, lon: -47.4, altBase: 109, altSpread: 6, signalBase: -69, tempBase: -26, res: `4K`, fps: 24, status: `live`, img: `https://science.nasa.gov/wp-content/uploads/2024/10/aristarchus-crater-lro-web-1.jpg` },
  { id: `LC-09`, name: `Shackleton (South Pole)`, region: `South Polar Region`, lat: -89.9, lon: 0, altBase: 134, altSpread: 9, signalBase: -75, tempBase: -178, res: `2K`, fps: 12, status: `standby`, img: `https://www.nasa.gov/wp-content/uploads/2024/04/m1464323568-lrmos-warp-4zoom.png` },
  { id: `LC-10`, name: `Taurus-Littrow`, region: `Apollo 17 Valley`, lat: 20.2, lon: 30.8, altBase: 101, altSpread: 5, signalBase: -65, tempBase: -19, res: `4K`, fps: 24, status: `live`, img: `https://lroc.im-ldi.com/news/uploads/ap17_lm_25cm.png` },
  { id: `LC-11`, name: `Schrödinger Basin`, region: `Far-side Relay`, lat: -75, lon: 132.4, altBase: 142, altSpread: 10, signalBase: -78, tempBase: -52, res: `2K`, fps: 12, status: `standby`, img: `https://lroc.im-ldi.com/ckeditor_assets/pictures/1579/content_M1350367385LR_1300p_panel.png` },
  { id: `LC-12`, name: `Earthrise Optic`, region: `Orbital Platform 2`, lat: 0, lon: 0, altBase: 384, altSpread: 18, signalBase: -61, tempBase: 4, res: `4K`, fps: 30, status: `live`, img: `https://images.unsplash.com/photo-1777033356671-59469ab29684?fm=jpg&q=70&w=1200&auto=format&fit=crop` },
];
const STATUS_LABEL = { live: `Live`, standby: `Standby`, "sun-glare": `Sun glare` };
const NASA_QUERY = {
  "LC-01": `Tycho Crater moon`, "LC-02": `Sea of Tranquility Apollo 11`, "LC-03": `Copernicus Crater`,
  "LC-04": `Mare Imbrium moon`, "LC-05": `Oceanus Procellarum moon`, "LC-06": `Mare Serenitatis moon`,
  "LC-07": `Plato crater lunar reconnaissance`, "LC-08": `Aristarchus crater moon`, "LC-09": `lunar south pole crater`,
  "LC-10": `Taurus-Littrow moon`, "LC-11": `Schrodinger Basin moon`, "LC-12": `Earthrise`,
};
const MOON_SEARCH_TERMS = [`lunar`, `moon`, `Nova-C`, `Griffin`, `Blue Ghost`, `Chang'e`, `Chandrayaan`, `Artemis`];
const AGENCY_WATCH_LINKS = {
  NASA: `https://plus.nasa.gov/`, SpaceX: `https://www.spacex.com/launches/`,
  "Blue Origin": `https://www.youtube.com/@blueorigin`, "Firefly Aerospace": `https://www.youtube.com/@fireflyaerospace`,
  "Intuitive Machines": `https://www.youtube.com/@intuitivemachines`, ispace: `https://www.youtube.com/@ispace-inc`,
  CNSA: `https://www.youtube.com/@cctvvideonewsagency`, ISRO: `https://www.youtube.com/@isro`,
};
const MOON_EVENTS_CACHE_KEY = `lc-moon-events-v1`;
const MOON_EVENTS_CACHE_TTL = 45 * 60 * 1000;
const CURATED_MOON_EVENTS = [
  { id: `curated-change7`, name: `Chang'e 7`, agencyName: `CNSA`, net: `2026-08-31T00:00:00Z`, netPrecision: `Month`, description: `Chinese orbiter, lander, and rover mission to the lunar south pole, searching for water ice ahead of the International Lunar Research Station.`, image: null, isLive: false },
  { id: `curated-griffin1`, name: `Griffin Mission One`, agencyName: `Astrobotic`, net: `2026-11-30T00:00:00Z`, netPrecision: `Month`, description: `Astrobotic's Griffin lander delivers NASA's VIPER-class payloads toward the lunar south pole under the CLPS program.`, image: null, isLive: false },
  { id: `curated-imnova3`, name: `Nova-C IM-3`, agencyName: `Intuitive Machines`, net: `2026-12-31T00:00:00Z`, netPrecision: `Month`, description: `Intuitive Machines' third Moon landing attempt, targeting the Reiner Gamma swirl region.`, image: null, isLive: false },
  { id: `curated-blueghost2`, name: `Blue Ghost Lunar Lander Mission 2`, agencyName: `Firefly Aerospace`, net: `2026-12-31T00:00:00Z`, netPrecision: `Month`, description: `Firefly's second Moon lander heads for the lunar far side, deploying a communications relay satellite along the way.`, image: null, isLive: false },
  { id: `curated-artemis3`, name: `Artemis III`, agencyName: `NASA`, net: `2027-06-30T00:00:00Z`, netPrecision: `Month`, description: `Crewed lunar-orbit rendezvous and docking demonstration with the commercial human landing systems, paving the way for a crewed landing.`, image: null, isLive: false },
];
const FACTS = [
  { fact: `The Moon drifts 3.8 cm farther from Earth every year.`, detail: `Tidal friction slowly transfers Earth's rotational energy to the Moon's orbit.` },
  { fact: `There is water ice hiding in the permanently shadowed polar craters.`, detail: `Floors near the south pole never see sunlight and stay near -240°C, trapping ice.` },
  { fact: `The Moon has quakes - moonquakes - that can last for over an hour.`, detail: `Apollo seismometers recorded them; with no water to damp the shaking, it rings on.` },
  { fact: `A lunar day lasts about 29.5 Earth days.`, detail: `That's why a single feed can sit in sunlight or darkness for two weeks at a time.` },
  { fact: `Surface temperatures swing from about 127°C in sunlight to -173°C at night.`, detail: `With almost no atmosphere, there's nothing to hold the heat once the Sun sets.` },
  { fact: `The same side of the Moon always faces Earth.`, detail: `It's tidally locked - one rotation per orbit - so the far side stays out of view.` },
  { fact: `Footprints left by the Apollo astronauts could last millions of years.`, detail: `No wind or rain means the regolith is only disturbed by rare micrometeorite impacts.` },
];

const reduced = () => window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;

// ---------- NASA gallery data layer ----------
const galleryCache = new Map();
function isMoonish(item) {
  const d = item.data && item.data[0];
  if (!d) return false;
  const kw = (d.keywords || []).join(` `).toLowerCase();
  const title = (d.title || ``).toLowerCase();
  return kw.includes(`moon`) || kw.includes(`lunar`) || title.includes(`moon`) || title.includes(`lunar`);
}
function pickLink(links, prefs) {
  for (const p of prefs) {
    const hit = (links || []).find((l) => l.href && l.href.includes(p));
    if (hit) return hit.href;
  }
  return links && links[0] && links[0].href;
}
function mapNasaItems(items) {
  return items
    .filter((it) => it.data && it.data[0] && it.links && it.links.length)
    .map((it) => {
      const d = it.data[0];
      return {
        id: d.nasa_id,
        title: d.title,
        credit: d.secondary_creator || d.center || `NASA`,
        date: d.date_created ? d.date_created.slice(0, 10) : ``,
        thumb: pickLink(it.links, [`~thumb.jpg`, `~small.jpg`]),
        full: pickLink(it.links, [`~large.jpg`, `~medium.jpg`, `~orig`]),
      };
    })
    .filter((p) => p.thumb && p.full);
}
async function searchNasa(q) {
  const res = await fetch(`https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`nasa search failed`);
  const json = await res.json();
  return json?.collection?.items || [];
}
async function fetchGallery(cam) {
  if (galleryCache.has(cam.id)) return galleryCache.get(cam.id);
  const seed = { id: `${cam.id}-seed`, title: cam.name, credit: `LunarCams`, date: ``, thumb: cam.img, full: cam.img };
  const out = [seed];
  try {
    let items = mapNasaItems((await searchNasa(NASA_QUERY[cam.id] || `${cam.name} moon`)).filter(isMoonish));
    if (items.length < 4) items = items.concat(mapNasaItems((await searchNasa(`${cam.region} moon lunar surface`)).filter(isMoonish)));
    if (items.length < 4) items = items.concat(mapNasaItems((await searchNasa(`Moon lunar surface Apollo craters`)).filter(isMoonish)));
    const seen = new Set([seed.id]);
    for (const it of items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
      if (out.length >= 21) break;
    }
  } catch (e) { /* keep the seed photo */ }
  galleryCache.set(cam.id, out);
  return out;
}

// ---------- Launch Library 2 / events data layer ----------
function formatEventDate(net, precision) {
  const d = new Date(net);
  if (precision === `Month`) return d.toLocaleDateString(`en-US`, { month: `long`, year: `numeric`, timeZone: `UTC` });
  if (precision === `Year`) return d.toLocaleDateString(`en-US`, { year: `numeric`, timeZone: `UTC` });
  return d.toLocaleDateString(`en-US`, { month: `short`, day: `numeric`, year: `numeric`, timeZone: `UTC` });
}
function normalizeLaunch(e) {
  const t = e.net ? new Date(e.net).getTime() : NaN;
  if (!e.net || Number.isNaN(t)) return null;
  return {
    id: e.id,
    name: e.mission?.name || e.name,
    agencyName: e.launch_service_provider?.name || e.mission?.agencies?.[0]?.name || `Unknown agency`,
    net: e.net,
    netPrecision: e.net_precision?.name || `Day`,
    description: e.mission?.description || ``,
    image: e.image?.image_url || null,
    isLive: !!e.webcast_live,
    statusAbbrev: e.status?.abbrev || `TBD`,
  };
}
async function fetchLaunchesFor(term) {
  const res = await fetch(`https://ll.thespacedevs.com/2.3.0/launches/upcoming/?search=${encodeURIComponent(term)}&limit=15`);
  if (!res.ok) throw new Error(`launch library request failed`);
  const json = await res.json();
  return json?.results || [];
}
async function fetchMoonEvents() {
  try {
    const cached = localStorage.getItem(MOON_EVENTS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.savedAt < MOON_EVENTS_CACHE_TTL) return parsed.events;
    }
  } catch (e) {}
  try {
    const batches = await Promise.all(MOON_SEARCH_TERMS.map((t) => fetchLaunchesFor(t).catch(() => [])));
    const byId = new Map();
    for (const batch of batches) for (const raw of batch) {
      const norm = normalizeLaunch(raw);
      if (norm && !byId.has(norm.id)) byId.set(norm.id, norm);
    }
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const events = [...byId.values()].filter((e) => new Date(e.net).getTime() > cutoff).sort((a, b) => new Date(a.net) - new Date(b.net));
    if (events.length === 0) throw new Error(`no live events, use fallback`);
    try { localStorage.setItem(MOON_EVENTS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), events })); } catch (e) {}
    return events;
  } catch (e) {
    return CURATED_MOON_EVENTS;
  }
}
function icsEscape(s) { return String(s).replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, `\\n`); }
function icsTimestamp(t) { return new Date(t).toISOString().replace(/[-:]/g, ``).split(`.`)[0] + `Z`; }
function downloadIcs(ev) {
  const start = new Date(ev.net).getTime();
  const body = [
    `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//LunarCams//Moon Events//EN`, `BEGIN:VEVENT`,
    `UID:${ev.id}@lunarcams.com`, `DTSTAMP:${icsTimestamp(Date.now())}`, `DTSTART:${icsTimestamp(start)}`,
    `DTEND:${icsTimestamp(start + 2 * 60 * 60 * 1000)}`, `SUMMARY:${icsEscape(ev.name)} (${icsEscape(ev.agencyName)})`,
    `DESCRIPTION:${icsEscape(ev.description || `Tracked live on LunarCams.`)}`, `END:VEVENT`, `END:VCALENDAR`,
  ].join(`\r\n`);
  const blob = new Blob([body], { type: `text/calendar` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement(`a`);
  a.href = url;
  a.download = `${ev.name.replace(/[^a-z0-9]+/gi, `-`)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- state ----------
let activeCameraId = LOCATIONS[0].id;
let moonEvents = [];
let moonEventsStatus = `loading`;
let feedFilter = `all`;
let factIndex = 0;
const telemetryState = new Map();
LOCATIONS.forEach((cam) => telemetryState.set(cam.id, { alt: cam.altBase, signal: cam.signalBase, temp: cam.tempBase, power: 96, downlink: 210 }));

function activeCamera() { return LOCATIONS.find((c) => c.id === activeCameraId) || LOCATIONS[0]; }
function clampTo(val, base, spread) { return Math.min(base + spread, Math.max(base - spread, val)); }
function tickTelemetry() {
  for (const cam of LOCATIONS) {
    const s = telemetryState.get(cam.id);
    s.alt = Number(clampTo(s.alt + (Math.random() - 0.5) * cam.altSpread * 0.6, cam.altBase, cam.altSpread).toFixed(1));
    s.signal = Number(clampTo(s.signal + (Math.random() - 0.5) * 1.4, cam.signalBase, 4).toFixed(0));
    s.temp = Number(clampTo(s.temp + (Math.random() - 0.5) * 1.6, cam.tempBase, 5).toFixed(1));
    s.power = Number(clampTo(s.power + (Math.random() - 0.5) * 0.8, 96, 5).toFixed(0));
    s.downlink = Number(clampTo(s.downlink + (Math.random() - 0.5) * 16, 210, 40).toFixed(0));
  }
}

function goto(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reduced() ? `auto` : `smooth`, block: `start` });
}
document.querySelectorAll(`[data-goto]`).forEach((btn) => btn.addEventListener(`click`, () => { goto(btn.dataset.goto); closeNavMenu(); }));
document.getElementById(`backTop`).addEventListener(`click`, () => window.scrollTo({ top: 0, behavior: reduced() ? `auto` : `smooth` }));

// ---------- nav menu ----------
const navTrigger = document.getElementById(`navTrigger`);
const navMenu = document.getElementById(`navMenu`);
function openNavMenu() {
  navMenu.classList.add(`open`);
  navTrigger.setAttribute(`aria-expanded`, `true`);
  document.addEventListener(`click`, onNavOutsideClick, true);
  document.addEventListener(`keydown`, onNavKeydown);
}
function closeNavMenu() {
  navMenu.classList.remove(`open`);
  navTrigger.setAttribute(`aria-expanded`, `false`);
  document.removeEventListener(`click`, onNavOutsideClick, true);
  document.removeEventListener(`keydown`, onNavKeydown);
}
function onNavOutsideClick(e) {
  if (!e.target.closest(`.nav-wrap`)) closeNavMenu();
}
function onNavKeydown(e) {
  if (e.key === `Escape`) closeNavMenu();
}
navTrigger.addEventListener(`click`, () => { navMenu.classList.contains(`open`) ? closeNavMenu() : openNavMenu(); });

// ---------- UTC clock ----------
function tickClock() {
  const now = new Date();
  document.getElementById(`utcClock`).textContent = now.toLocaleTimeString(`en-GB`, { hour: `2-digit`, minute: `2-digit`, second: `2-digit`, timeZone: `UTC` });
}
const liveCount = LOCATIONS.filter((c) => c.status === `live`).length;
document.getElementById(`feedsLive`).textContent = `${liveCount} / ${LOCATIONS.length}`;
document.getElementById(`tileCameras`).textContent = String(LOCATIONS.length);
document.getElementById(`footStat`).textContent = `${liveCount} feeds live · ${LOCATIONS.length} cameras deployed`;

// ---------- hero: embedded 3D blueprint globe ----------
let heroGlobe = null;
function mountHeroGlobe() {
  const host = document.getElementById(`heroGlobeHost`);
  const status = document.getElementById(`heroGlobeStatus`);
  import(`../assets/moon-globe.js`).then((mod) => {
    heroGlobe = mod.mountMoonGlobe(host, {
      locations: LOCATIONS.map((c) => ({ id: c.id, name: c.name, lat: c.lat, lon: c.lon })),
      blueprint: true,
      activeId: activeCameraId,
      accentHex: 0xb8792e,
      autoRotate: !reduced(),
      onReady: () => { status.style.display = `none`; },
      onError: () => { status.textContent = `The 3D surface plot couldn't load in this browser.`; },
      onHoverLocation: (loc) => showHeroHover(loc),
      onSelectLocation: (loc) => showHeroGlobeInfo(loc),
    });
  }).catch(() => { status.textContent = `The 3D surface plot couldn't load in this browser.`; });
}
function showHeroHover(loc) {
  let el = document.getElementById(`heroGlobeHover`);
  if (!loc) { el?.remove(); return; }
  if (!el) {
    el = document.createElement(`div`); el.id = `heroGlobeHover`; el.className = `hero-globe-hover`;
    document.getElementById(`heroGlobe`).appendChild(el);
  }
  el.textContent = loc.name;
}
function showHeroGlobeInfo(loc) {
  const host = document.getElementById(`heroGlobe`);
  const hint = host.querySelector(`.hero-globe-hint`);
  if (hint) hint.style.display = `none`;
  let el = document.getElementById(`heroGlobeInfo`);
  if (!el) { el = document.createElement(`div`); el.id = `heroGlobeInfo`; el.className = `globe-info`; host.appendChild(el); }
  const ns = loc.lat >= 0 ? `N` : `S`, ew = loc.lon >= 0 ? `E` : `W`;
  el.innerHTML = `<button class="modal-close" id="heroGlobeInfoClose" aria-label="Close" style="position:absolute;top:8px;right:8px;width:24px;height:24px;font-size:12px;background:rgba(255,255,255,0.7)">✕</button>
    <div><h4>${loc.name}</h4><span class="coord">${Math.abs(loc.lat).toFixed(1)}° ${ns}, ${Math.abs(loc.lon).toFixed(1)}° ${ew}</span></div>
    <div class="globe-actions"><button class="btn btn-ghost" id="heroGlobeSetActive">Set active</button><button class="btn btn-primary" id="heroGlobeViewGallery">View gallery</button></div>`;
  document.getElementById(`heroGlobeInfoClose`).addEventListener(`click`, () => { el.remove(); if (hint) hint.style.display = ``; });
  document.getElementById(`heroGlobeSetActive`).addEventListener(`click`, () => setActiveCamera(loc.id, false));
  document.getElementById(`heroGlobeViewGallery`).addEventListener(`click`, () => {
    const cam = LOCATIONS.find((c) => c.id === loc.id);
    if (cam) openGallery(cam);
  });
}

function setActiveCamera(id, scrollToCard) {
  activeCameraId = id;
  heroGlobe?.setActive(id);
  globeInstance?.setActive(id);
  renderBank();
  if (scrollToCard) {
    goto(`feeds`);
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-card-id="${id}"]`);
      if (card) { card.style.background = `var(--brass-soft)`; setTimeout(() => { card.style.background = ``; }, 900); }
    });
  }
}

// ---------- hero ----------
function liveWindowEvent(events, now) {
  return events.find((e) => {
    const net = new Date(e.net).getTime();
    return now - net > -30 * 60 * 1000 && now - net < 6 * 60 * 60 * 1000;
  });
}
function renderHero() {
  const now = Date.now();
  const sorted = moonEvents;
  const live = liveWindowEvent(sorted, now);
  const nextIdx = sorted.findIndex((e) => new Date(e.net).getTime() > now);
  const next = live || (nextIdx >= 0 ? sorted[nextIdx] : null);
  const isLive = !!live;

  document.getElementById(`sheetNo`).textContent = next ? `SHEET NO. ${String((live ? 0 : nextIdx) + 1).padStart(2, `0`)}` : `SHEET NO. —`;
  const badge = document.getElementById(`heroBadge`);
  const badgeText = document.getElementById(`heroBadgeText`);
  badge.classList.toggle(`live`, isLive);
  badgeText.textContent = isLive ? `Live now` : `Next event`;
  document.getElementById(`heroAgency`).textContent = next ? next.agencyName : `Checking mission schedules…`;
  document.getElementById(`heroHeadline`).textContent = next ? next.name : `Tracking the next Moon mission`;
  document.getElementById(`heroDesc`).textContent = next
    ? (next.description || `${formatEventDate(next.net, next.netPrecision)} · tracked live from public launch schedules.`)
    : `LunarCams tracks real launches and landing attempts headed for the Moon, sourced live from public spaceflight schedules.`;

  const wrap = document.getElementById(`heroCountdownWrap`);
  if (next && isLive) {
    wrap.innerHTML = `<div class="underway"><span class="dot"></span>Mission underway</div>`;
  } else if (next) {
    const rem = Math.max(0, new Date(next.net).getTime() - now);
    const d = Math.floor(rem / 86400000), h = Math.floor((rem % 86400000) / 3600000), m = Math.floor((rem % 3600000) / 60000), s = Math.floor((rem % 60000) / 1000);
    const cells = [[`Days`, d], [`Hours`, h], [`Min`, m], [`Sec`, s]];
    wrap.innerHTML = `<div class="chrono">${cells.map(([lbl, v], i) => `${i > 0 ? `<span class="sep">:</span>` : ``}<div class="cell"><span class="num">${String(v).padStart(2, `0`)}</span><span class="lbl">${lbl}</span></div>`).join(``)}</div>`;
  } else {
    wrap.innerHTML = ``;
  }

  const watchBtn = document.getElementById(`heroWatchBtn`);
  const calBtn = document.getElementById(`heroCalBtn`);
  if (isLive) {
    watchBtn.style.display = ``; watchBtn.href = AGENCY_WATCH_LINKS[next?.agencyName] || `https://plus.nasa.gov/`;
    calBtn.style.display = `none`;
  } else {
    watchBtn.style.display = `none`; calBtn.style.display = ``;
    calBtn.disabled = !next;
    calBtn.onclick = () => next && downloadIcs(next);
  }
  document.getElementById(`tileMissions`).textContent = String(sorted.length);
}

// ---------- events log ----------
function renderEventsLog() {
  const el = document.getElementById(`eventsLog`);
  if (moonEventsStatus === `loading`) { el.innerHTML = `<p class="gal-status">Loading mission schedules…</p>`; return; }
  if (moonEvents.length === 0) { el.innerHTML = `<p class="gal-status">No mission schedule data available right now — check back shortly.</p>`; return; }
  const now = Date.now();
  el.innerHTML = moonEvents.map((e, i) => {
    const net = new Date(e.net).getTime();
    const isLive = now - net > -30 * 60 * 1000 && now - net < 6 * 60 * 60 * 1000;
    const status = isLive ? `<span class="log-status live">Live now</span>` : net > now ? `<span class="log-status soon">T-minus</span>` : `<span class="log-status">Logged</span>`;
    return `<div class="log-row">
      <span class="log-idx">No. ${String(i + 1).padStart(2, `0`)}</span>
      <div class="log-main">
        <p class="log-name">${e.name}</p>
        <p class="log-meta">${e.agencyName} · ${formatEventDate(e.net, e.netPrecision)}</p>
        <p class="log-desc">${e.description || `Tracked live from public launch schedules.`}</p>
      </div>
      <div class="log-side">
        ${status}
        <button class="log-cal" data-cal-idx="${i}">Add to calendar</button>
      </div>
    </div>`;
  }).join(``);
  el.querySelectorAll(`[data-cal-idx]`).forEach((btn) => btn.addEventListener(`click`, () => downloadIcs(moonEvents[Number(btn.dataset.calIdx)])));
}

// ---------- chart index / camera grid ----------
function renderFilters() {
  const el = document.getElementById(`filters`);
  const groups = [`all`, `live`, `sun-glare`, `standby`];
  el.innerHTML = groups.map((g) => {
    const count = g === `all` ? LOCATIONS.length : LOCATIONS.filter((c) => c.status === g).length;
    const label = g === `all` ? `All` : STATUS_LABEL[g];
    return `<button class="filter-pill" data-filter="${g}" aria-pressed="${g === feedFilter}">${label} (${count})</button>`;
  }).join(``);
  el.querySelectorAll(`[data-filter]`).forEach((btn) => btn.addEventListener(`click`, () => { feedFilter = btn.dataset.filter; renderFilters(); renderIndexGrid(); }));
}
function renderIndexGrid() {
  const el = document.getElementById(`indexGrid`);
  const list = feedFilter === `all` ? LOCATIONS : LOCATIONS.filter((c) => c.status === feedFilter);
  el.innerHTML = list.map((cam) => {
    const ns = cam.lat >= 0 ? `N` : `S`, ew = cam.lon >= 0 ? `E` : `W`;
    return `<button class="index-card glass" data-card-id="${cam.id}">
      <div class="row1"><span class="region">${cam.region}</span><span class="status-dot ${cam.status}"></span></div>
      <span class="site-name">${cam.name}</span>
      <span class="coord">${Math.abs(cam.lat).toFixed(1)}° ${ns}, ${Math.abs(cam.lon).toFixed(1)}° ${ew}</span>
      <span class="specs">${cam.res} · ${cam.fps}fps · ${STATUS_LABEL[cam.status]}</span>
    </button>`;
  }).join(``);
  el.querySelectorAll(`[data-card-id]`).forEach((card) => card.addEventListener(`click`, () => {
    const cam = LOCATIONS.find((c) => c.id === card.dataset.cardId);
    setActiveCamera(cam.id, false);
    openGallery(cam);
  }));
}

// ---------- telemetry bank ----------
function renderBank() {
  const cam = activeCamera();
  const t = telemetryState.get(cam.id);
  document.getElementById(`telemetryNote`).textContent = `Streaming from ${cam.name} · sampled every 1.4 seconds.`;
  const gauges = [
    { label: `Array power`, value: t.power, unit: `%`, warn: t.power < 93 },
    { label: `Skin temp`, value: t.temp, unit: `°C`, warn: false },
    { label: `Downlink`, value: t.downlink, unit: `Mbps`, warn: false },
    { label: `Signal`, value: t.signal, unit: `dBm`, warn: t.signal < cam.signalBase - 3 },
  ];
  document.getElementById(`bank`).innerHTML = gauges.map((g) => `<div class="gauge glass"><dt>${g.label}</dt><dd>${g.value}<span> ${g.unit}</span></dd></div>`).join(``);
}

// ---------- facts (marginalia) ----------
function renderFact() {
  const f = FACTS[factIndex];
  document.getElementById(`factText`).innerHTML = `${f.fact}<span class="detail">${f.detail}</span>`;
}
document.getElementById(`factPrev`).addEventListener(`click`, () => { factIndex = (factIndex - 1 + FACTS.length) % FACTS.length; renderFact(); });
document.getElementById(`factNext`).addEventListener(`click`, () => { factIndex = (factIndex + 1) % FACTS.length; renderFact(); });
renderFact();
if (!reduced()) setInterval(() => { factIndex = (factIndex + 1) % FACTS.length; renderFact(); }, 6000);

// ---------- gallery modal ----------
const modalHost = document.getElementById(`modalHost`);
let galleryState = null;
function closeModal() {
  modalHost.innerHTML = ``;
  document.body.style.overflow = ``;
  window.removeEventListener(`keydown`, onModalKeydown);
}
function onModalKeydown(evt) {
  if (evt.key === `Escape`) { closeModal(); if (globeInstance) { globeInstance.destroy(); globeInstance = null; } }
  if (galleryState) {
    if (evt.key === `ArrowLeft`) stepGallery(-1);
    if (evt.key === `ArrowRight`) stepGallery(1);
  }
}
async function openGallery(cam) {
  galleryState = { cam, photos: [], index: 0, status: `loading` };
  document.body.style.overflow = `hidden`;
  window.addEventListener(`keydown`, onModalKeydown);
  renderGalleryModal();
  const photos = await fetchGallery(cam);
  if (!galleryState || galleryState.cam.id !== cam.id) return;
  galleryState.photos = photos;
  galleryState.status = `ready`;
  renderGalleryModal();
}
function stepGallery(dir) {
  if (!galleryState || !galleryState.photos.length) return;
  galleryState.index = (galleryState.index + dir + galleryState.photos.length) % galleryState.photos.length;
  renderGalleryModal();
}
function renderGalleryModal() {
  const s = galleryState;
  if (!s) return;
  const photo = s.photos[s.index];
  modalHost.innerHTML = `<div class="modal-backdrop" id="galBackdrop">
    <div class="modal-panel" style="max-width:820px">
      <div class="modal-head"><h3>${s.cam.name} — photo gallery</h3><button class="modal-close" id="galClose" aria-label="Close">✕</button></div>
      <div class="gal-stage" id="galStage">
        ${s.status === `loading` ? `<p class="gal-status" style="color:#fff">Loading photos from the NASA image library…</p>` : `
          <div class="gal-track"><img src="${photo.full}" alt="${photo.title}"></div>
          ${s.photos.length > 1 ? `<button class="gal-nav gal-prev" id="galPrev" aria-label="Previous photo">‹</button><button class="gal-nav gal-next" id="galNext" aria-label="Next photo">›</button>` : ``}
        `}
      </div>
      ${s.status === `ready` ? `<div class="gal-caption"><p class="t">${photo.title}</p><p class="c">${photo.credit}${photo.date ? ` · ${photo.date}` : ``} · ${s.index + 1} / ${s.photos.length}</p></div>
      <div class="gal-strip" id="galStrip">${s.photos.map((p, i) => `<div class="gal-thumb${i === s.index ? ` active` : ``}" data-idx="${i}"><img src="${p.thumb}" alt=""></div>`).join(``)}</div>` : ``}
    </div>
  </div>`;
  document.getElementById(`galClose`).addEventListener(`click`, () => { closeModal(); galleryState = null; });
  document.getElementById(`galBackdrop`).addEventListener(`click`, (e) => { if (e.target.id === `galBackdrop`) { closeModal(); galleryState = null; } });
  const prev = document.getElementById(`galPrev`), next = document.getElementById(`galNext`);
  prev?.addEventListener(`click`, () => stepGallery(-1));
  next?.addEventListener(`click`, () => stepGallery(1));
  document.querySelectorAll(`#galStrip [data-idx]`).forEach((el) => el.addEventListener(`click`, () => { s.index = Number(el.dataset.idx); renderGalleryModal(); }));
  const stage = document.getElementById(`galStage`);
  if (stage && s.status === `ready` && s.photos.length > 1) wireSwipe(stage);
}
function wireSwipe(stage) {
  let downX = 0, dragging = false, moved = 0;
  const track = stage.querySelector(`.gal-track`);
  stage.addEventListener(`pointerdown`, (e) => {
    if (e.target.closest(`button`)) return;
    downX = e.clientX; dragging = true; moved = 0;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener(`pointermove`, (e) => {
    if (!dragging) return;
    const dx = e.clientX - downX;
    moved = Math.abs(dx);
    if (track) track.style.transform = `translateX(${dx}px)`;
  });
  function release(e) {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - downX;
    if (track) track.style.transform = ``;
    if (Math.abs(dx) > 60) stepGallery(dx > 0 ? -1 : 1);
  }
  stage.addEventListener(`pointerup`, release);
  stage.addEventListener(`pointercancel`, release);
}

// ---------- 3D globe modal ----------
let globeInstance = null;
document.getElementById(`openGlobeBtn`).addEventListener(`click`, openGlobeModal);
function openGlobeModal() {
  document.body.style.overflow = `hidden`;
  window.addEventListener(`keydown`, onModalKeydown);
  modalHost.innerHTML = `<div class="modal-backdrop" id="globeBackdrop">
    <div class="modal-panel" style="max-width:960px;height:88vh">
      <div class="modal-head"><h3>Plot the surface — 3D lunar explorer</h3><button class="modal-close" id="globeClose" aria-label="Close">✕</button></div>
      <div class="globe-body">
        <div class="globe-canvas-host" id="globeHost"></div>
        <div class="globe-status" id="globeStatus">Drafting the surface…</div>
      </div>
    </div>
  </div>`;
  document.getElementById(`globeClose`).addEventListener(`click`, closeGlobeModal);
  document.getElementById(`globeBackdrop`).addEventListener(`click`, (e) => { if (e.target.id === `globeBackdrop`) closeGlobeModal(); });
  const host = document.getElementById(`globeHost`);
  const status = document.getElementById(`globeStatus`);
  import(`../assets/moon-globe.js`).then((mod) => {
    globeInstance = mod.mountMoonGlobe(host, {
      locations: LOCATIONS.map((c) => ({ id: c.id, name: c.name, lat: c.lat, lon: c.lon })),
      blueprint: true,
      activeId: activeCameraId,
      accentHex: 0xb8792e,
      autoRotate: !reduced(),
      onReady: () => { status.style.display = `none`; },
      onError: () => { status.textContent = `The 3D explorer couldn't load in this browser.`; },
      onHoverLocation: (loc) => { showGlobeHover(loc); },
      onSelectLocation: (loc) => { showGlobeInfo(loc); },
    });
  }).catch(() => { status.textContent = `The 3D explorer couldn't load in this browser.`; });
}
function closeGlobeModal() {
  if (globeInstance) { globeInstance.destroy(); globeInstance = null; }
  closeModal();
}
function showGlobeHover(loc) {
  let el = document.getElementById(`globeHover`);
  if (!loc) { el?.remove(); return; }
  if (!el) {
    el = document.createElement(`div`); el.id = `globeHover`; el.className = `globe-hover`;
    document.getElementById(`globeHost`)?.parentElement.appendChild(el);
  }
  el.textContent = loc.name;
}
function showGlobeInfo(loc) {
  let el = document.getElementById(`globeInfo`);
  const host = document.getElementById(`globeHost`);
  if (!host) return;
  if (!el) { el = document.createElement(`div`); el.id = `globeInfo`; el.className = `globe-info`; host.parentElement.appendChild(el); }
  const ns = loc.lat >= 0 ? `N` : `S`, ew = loc.lon >= 0 ? `E` : `W`;
  el.innerHTML = `<div><h4>${loc.name}</h4><span class="coord">${Math.abs(loc.lat).toFixed(1)}° ${ns}, ${Math.abs(loc.lon).toFixed(1)}° ${ew}</span></div>
    <div class="globe-actions"><button class="btn btn-ghost" id="globeSetActive">Set active</button><button class="btn btn-primary" id="globeViewGallery">View gallery</button></div>`;
  document.getElementById(`globeSetActive`).addEventListener(`click`, () => { setActiveCamera(loc.id, false); globeInstance?.setActive(loc.id); globeInstance?.focusOn(loc.id); });
  document.getElementById(`globeViewGallery`).addEventListener(`click`, () => {
    const cam = LOCATIONS.find((c) => c.id === loc.id);
    closeGlobeModal();
    if (cam) openGallery(cam);
  });
}

// ---------- boot ----------
tickClock();
setInterval(tickClock, 1000);
renderHero();
renderEventsLog();
renderFilters();
renderIndexGrid();
renderBank();
mountHeroGlobe();
setInterval(() => { renderHero(); renderEventsLog(); }, 1000);
setInterval(() => { tickTelemetry(); renderBank(); }, 1400);

fetchMoonEvents().then((events) => { moonEvents = events; moonEventsStatus = `ready`; renderHero(); renderEventsLog(); });
