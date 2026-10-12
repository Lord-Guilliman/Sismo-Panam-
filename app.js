// app.js — Interfaz de Sismo Panamá: consulta de fuentes, lista, mapa, alarma, modo vigilia y réplicas.
// La lógica "pura" (unir reportes, decidir qué es nuevo, réplicas) está en core.js.
(() => {
  'use strict';
  const C = window.SISMO_CONFIG;
  const Core = window.SismoCore;
  const $ = (id) => document.getElementById(id);

  const USGS_FDSN = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
  const USGS_FEED_FALLBACK = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson';
  const IGC_PAGE_URL = Core.IGC_PAGE_URL;
  const PANAMA_CITY = { lat: 8.9824, lon: -79.5199, label: 'Ciudad de Panamá' };
  const PERIOD_MS = { day: 86400000, week: 7 * 86400000, month: 30 * 86400000 };
  const PERIOD_LABEL = { day: 'Últimas 24 horas', week: 'Últimos 7 días', month: 'Últimos 30 días' };

  const state = {
    usgs: new Map(), igc: [], events: [], known: [],
    usgsOk: false, igcOk: false, igcFails: 0, lastIgcTry: 0, initialized: false, learned: { usgs: false, igc: false },
    lastUsgsFull: 0, lastUsgsFetch: 0, lastIgcFetch: 0, lastOk: 0, lastPoll: null, busy: false, pollTimer: null,
    center: { ...PANAMA_CITY }, map: null, markers: null, userMarker: null,
    soundOn: false, audio: null, alarmTimer: null,
    vigil: false, wakeLock: null, vigilTimer: null, connBeeped: false,
    sensorOn: false, sensorShare: false, sensorCoords: null, sensorSamples: [], sensorLowPass: null,
    lastSensorPing: 0, lastClusterIds: new Set(), installPrompt: null, clusterPollTimer: null
  };

  // ---------- Ajustes (se recuerdan en este navegador) ----------
  const settings = { period: 'day', minMag: 2.5, alertMag: 4.5, radius: 500, search: '', useRadius: true };
  const STORE_KEY = 'sismoPanamaSettings.v04';
  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      for (const k of ['period', 'minMag', 'alertMag', 'radius', 'useRadius']) if (saved[k] !== undefined) settings[k] = saved[k];
    } catch (_) { /* sin almacenamiento: se usan los valores por defecto */ }
    $('period').value = settings.period; $('minMag').value = String(settings.minMag);
    document.querySelectorAll('.chip[data-mag]').forEach((b) => b.addEventListener('click', () => { $('minMag').value = b.dataset.mag; $('minMag').dispatchEvent(new Event('change')); }));
    document.querySelectorAll('.chip[data-period]').forEach((b) => b.addEventListener('click', () => { $('period').value = b.dataset.period; $('period').dispatchEvent(new Event('change')); }));
    $('alertMagThreshold').value = String(settings.alertMag); $('radius').value = settings.radius;
    $('radiusRead').textContent = `${settings.radius} km`;
    $('magRead').textContent = settings.minMag === 0 ? 'Cualquiera' : `${Number(settings.minMag).toFixed(1)}+`;
    if (!settings.useRadius) $('centerLabel').textContent = 'Centro: radio desactivado';
  }
  function saveSettings() {
    try {
      const { period, minMag, alertMag, radius, useRadius } = settings;
      localStorage.setItem(STORE_KEY, JSON.stringify({ period, minMag, alertMag, radius, useRadius }));
    } catch (_) {}
  }

  // ---------- Utilidades ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch (_) { return '#'; } };
  const fmtTime = (d) => { try { return new Intl.DateTimeFormat('es-PA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Panama' }).format(d); } catch (_) { return d.toLocaleString(); } };
  const timeAgo = (d) => {
    const m = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
    return m < 1 ? 'hace menos de 1 min' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.floor(m / 60)} h` : `hace ${Math.floor(m / 1440)} d`;
  };
  const dist = (e) => Core.distKm(state.center.lat, state.center.lon, e.lat, e.lon);
  function setSource(id, text, cls = '') { const el = $(id); el.textContent = text; el.className = 'source-state ' + cls; }
  function ageLabel(timestamp) {
    if (!timestamp) return 'sin datos';
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return 'menos de 1 min';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
    return `${Math.floor(seconds / 3600)} h`;
  }
  function updateSourceAges() {
    if (state.lastUsgsFetch && state.usgsOk) {
      const ageMs = Date.now() - state.lastUsgsFetch;
      setSource('usgsState', `${state.usgs.size} eventos · actualizado hace ${ageLabel(state.lastUsgsFetch)}`, ageMs > 180000 ? 'warn' : 'ok');
    }
    if (state.lastIgcFetch && state.igcOk) {
      const ageMs = Date.now() - state.lastIgcFetch;
      setSource('igcState', `${state.igc.length} eventos · actualizado hace ${ageLabel(state.lastIgcFetch)}`, ageMs > 300000 ? 'warn' : 'ok');
    }
  }
  const sourceLine = (e) => e.reports.map((r) => `${r.source} M${r.mag.toFixed(1)}${r.status ? ' (' + r.status.toLowerCase() + ')' : ''}`).join(' · ');

  // ---------- Fuentes ----------
  function regionParams() {
    const R = C.REGION;
    return { minlatitude: R.minLat, maxlatitude: R.maxLat, minlongitude: R.minLon, maxlongitude: R.maxLon };
  }
  // modo 'full' = últimos 30 días; modo 'light' = solo lo nuevo o actualizado hace poco.
  async function fetchUsgs(mode) {
    const q = new URLSearchParams({ format: 'geojson', orderby: 'time', limit: '2000', eventtype: 'earthquake', ...regionParams() });
    const iso = (ms) => new Date(ms).toISOString().slice(0, 19);
    if (mode === 'full') q.set('starttime', iso(Date.now() - 30 * 86400000));
    else { q.set('starttime', iso(Date.now() - 6 * 3600000)); q.set('updatedafter', iso(Date.now() - 10 * 60000)); }
    let json;
    try {
      const r = await fetch(`${USGS_FDSN}?${q}`, { cache: 'no-store' });
      if (r.status === 204) json = { features: [] };
      else if (!r.ok) throw new Error(`HTTP ${r.status}`);
      else json = await r.json();
    } catch (err) {
      // Plan B: el feed semanal global, recortado a nuestra región.
      const r = await fetch(USGS_FEED_FALLBACK, { cache: 'no-store' });
      if (!r.ok) throw err;
      const R = C.REGION; json = await r.json();
      json.features = (json.features || []).filter((f) => { const c = f.geometry?.coordinates || []; return c[1] >= R.minLat && c[1] <= R.maxLat && c[0] >= R.minLon && c[0] <= R.maxLon; });
      mode = 'full';
    }
    const reports = (json.features || []).map(Core.usgsToReport).filter(Boolean);
    return { reports, mode };
  }
  async function fetchIgc() {
    // En el servidor local existe /api/igc. GitHub Pages es estático y esa ruta no existe;
    // allí se consulta directamente o se usa una URL de Cloudflare Worker indicada en config.js.
    const localDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const proxy = String(C.IGC_PROXY || '').trim() || (localDev ? 'api/igc' : '');
    let response;
    if (proxy) {
      response = await fetch(proxy, { cache: 'no-store' });
      if (!response.ok && (response.status === 404 || response.status === 501) && localDev) {
        response = await fetch(IGC_PAGE_URL, { cache: 'no-store' });
      }
    } else {
      response = await fetch(IGC_PAGE_URL, { cache: 'no-store' });
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reports = Core.parseIgcRows(await response.text(), window.DOMParser, IGC_PAGE_URL);
    if (!reports.length) throw new Error('No se reconoció la tabla pública');
    return reports;
  }

  async function refresh() {
    if (state.busy) return;
    state.busy = true; $('refreshBtn').disabled = true; $('refreshBtn').textContent = '↻ Consultando…';
    const now = Date.now();
    const wantFull = now - state.lastUsgsFull > 10 * 60000 || !state.learned.usgs;
    let igcEvery = document.hidden ? (C.IGC_POLL_SECONDS_HIDDEN || 180) : (state.vigil ? (C.IGC_POLL_SECONDS_VIGILIA || 30) : (C.IGC_POLL_SECONDS || 60));
    if (state.igcFails >= 3) igcEvery = Math.max(igcEvery, C.IGC_BACKOFF_SECONDS || 60); // el proxy falla: bajamos el ritmo
    const wantIgc = now - state.lastIgcTry >= igcEvery * 1000 - 1000;
    if (wantIgc) state.lastIgcTry = now;
    const [uRes, gRes] = await Promise.allSettled([fetchUsgs(wantFull ? 'full' : 'light'), wantIgc ? fetchIgc() : Promise.resolve(null)]);

    const newlyLearned = [];
    if (uRes.status === 'fulfilled') {
      const { reports, mode } = uRes.value;
      if (mode === 'full') { state.usgs = new Map(); state.lastUsgsFull = now; }
      reports.forEach((r) => state.usgs.set(r.rawId, r));
      if (!state.learned.usgs) { state.learned.usgs = true; newlyLearned.push('usgs'); }
      state.lastOk = now; state.lastUsgsFetch = now; state.usgsOk = true;
      setSource('usgsState', `${state.usgs.size} eventos en la región`, 'ok');
    } else {
      state.usgsOk = false; setSource('usgsState', 'Error de conexión', 'bad'); console.warn('USGS:', uRes.reason);
    }
    if (gRes.status === 'fulfilled') {
      if (gRes.value) {
        state.igc = gRes.value; state.lastIgcFetch = now; state.igcFails = 0;
        if (!state.learned.igc) { state.learned.igc = true; newlyLearned.push('igc'); }
        setSource('igcState', `${state.igc.length} eventos recibidos`, 'ok');
      }
      if (gRes.value) { state.igcOk = true; state.lastOk = now; }
    } else {
      state.igcOk = false; state.igcFails += 1;
      const isCors = gRes.reason instanceof TypeError;
      const oldData = state.lastIgcFetch ? ` · últimos datos hace ${ageLabel(state.lastIgcFetch)}` : '';
      setSource('igcState', (isCors ? 'Bloqueado por el navegador' : 'No disponible') + oldData, 'warn'); console.warn('IGC-UP:', gRes.reason);
    }

    state.events = Core.mergeSources([...state.usgs.values()], state.igc);
    detectAlerts(newlyLearned);
    state.lastPoll = new Date();
    $('lastUpdate').textContent = fmtTime(state.lastPoll);
    const ok = uRes.status === 'fulfilled' || (gRes.status === 'fulfilled' && gRes.value);
    $('globalStatus').textContent = ok ? 'Conectado al menos a una fuente · actualización automática activa' : 'No se pudo conectar con las fuentes';
    $('metricSources').textContent = `${Number(!!state.usgsOk) + Number(!!state.igcOk)}/2`;
    $('refreshBtn').disabled = false; $('refreshBtn').textContent = '↻ Actualizar'; state.busy = false;
    updateSourceAges(); render(); renderSequence(); updateVigil();
  }

  // ---------- Decidir cuándo alertar ----------
  function isAlertWorthy(e) {
    if (e.mag >= C.ALWAYS_ALERT_MAG) return true;
    return e.mag >= settings.alertMag && (!settings.useRadius || dist(e) <= settings.radius);
  }
  function detectAlerts(newlyLearned) {
    const now = Date.now();
    const maxAge = C.MAX_ALERT_AGE_HOURS * 3600000;
    const candidates = [];
    for (const e of state.events) {
      const kind = Core.classify(e, state.known);
      Core.remember(e, state.known);
      if (kind === 'known' || !state.initialized) continue;
      // Una fuente que acaba de conectarse por primera vez trae sismos viejos: se aprenden sin sonar.
      if (newlyLearned.length && now - e.time > 180000) continue;
      if (now - e.time > maxAge) continue;
      if (isAlertWorthy(e)) candidates.push({ e, kind });
    }
    state.initialized = true;
    if (candidates.length) {
      candidates.sort((a, b) => b.e.mag - a.e.mag);
      triggerAlert(candidates[0].e, candidates[0].kind);
    }
  }

  // ---------- Lista, métricas, mapa ----------
  function visibleEvents() {
    const q = settings.search.trim().toLocaleLowerCase('es');
    const since = Date.now() - PERIOD_MS[settings.period];
    return state.events.filter((e) => e.time >= since && e.mag >= settings.minMag
      && (!settings.useRadius || dist(e) <= settings.radius)
      && (!q || e.place.toLocaleLowerCase('es').includes(q) || e.reports.some((r) => r.source.toLowerCase().includes(q))));
  }
  function renderHero(events) {
    const e = events[0];
    const mag = $('heroMag');
    if (!e) { mag.textContent = '—'; mag.className = 'hero-mag'; $('heroPlace').textContent = state.lastPoll ? 'Sin sismos en este filtro' : 'Consultando los catálogos sísmicos…'; $('heroMeta').textContent = ''; $('heroSrc').innerHTML = ''; return; }
    mag.textContent = e.mag.toFixed(1); mag.className = 'hero-mag ' + Core.magLevel(e.mag);
    $('heroPlace').textContent = e.place;
    $('heroMeta').innerHTML = `<span>◷ ${esc(fmtTime(e.time))} · ${esc(timeAgo(e.time))}</span><span>↗ ${Math.round(dist(e))} km de ${esc(state.center.label)}</span><span>↓ ${Number(e.depth).toFixed(0)} km de profundidad</span>`;
    $('heroSrc').innerHTML = e.reports.map((r) => `<span class="src" title="${esc(r.status)}">${esc(r.source)} ${r.mag.toFixed(1)}${r.status ? ' · ' + esc(r.status.toLowerCase()) : ''}</span>`).join('');
  }
  function syncChips() {
    document.querySelectorAll('.chip[data-mag]').forEach((b) => b.classList.toggle('on', Number(b.dataset.mag) === Number(settings.minMag)));
    document.querySelectorAll('.chip[data-period]').forEach((b) => b.classList.toggle('on', b.dataset.period === settings.period));
  }
  function render() {
    const events = visibleEvents();
    renderHero(events); syncChips();
    $('metricTotal').textContent = events.length;
    const biggest = events.reduce((m, e) => Math.max(m, e.mag), -Infinity);
    $('metricMax').textContent = Number.isFinite(biggest) ? biggest.toFixed(1) : '—';
    const big = events.find((e) => e.mag === biggest);
    $('metricMaxSub').textContent = big ? `${big.place} · ${timeAgo(big.time)}` : 'Sin eventos en este filtro';
    const since = Date.now() - PERIOD_MS[settings.period];
    $('metricNear').textContent = state.events.filter((e) => e.time >= since && dist(e) <= settings.radius && e.mag >= settings.minMag).length;
    $('listCount').textContent = `${events.length} evento${events.length === 1 ? '' : 's'}`;
    $('listSubtitle').textContent = `${PERIOD_LABEL[settings.period]} · distancia desde ${state.center.label}` + (settings.period === 'month' ? ' · IGC-UP solo publica 7 días' : '');

    const list = $('quakeList');
    if (!events.length) {
      list.innerHTML = '<div class="empty">No hay eventos que coincidan con estos filtros.<br>Prueba aumentar el radio o bajar la magnitud mínima.</div>';
    } else {
      list.innerHTML = events.slice(0, 100).map((e) => {
        const fresh = Date.now() - e.time < 10 * 60000;
        const chips = e.reports.map((r) => `<span class="src" title="${esc(r.status)}">${esc(r.source)} ${r.mag.toFixed(1)}</span>`).join('');
        const link = e.reports.map((r) => `<a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">${esc(r.source)} ↗</a>`).join('');
        return `<article class="quake${fresh ? ' fresh' : ''}"><div class="mag ${Core.magLevel(e.mag)}">${e.mag.toFixed(1)}</div><div class="quake-main">
          <div class="quake-top"><div class="quake-title">${esc(e.place)}${fresh ? ' <span class="new-tag">NUEVO</span>' : ''}${e.tsunami ? ' <span class="new-tag warn">TSUNAMI: revisar</span>' : ''}</div><div class="srcs">${chips}</div></div>
          <div class="quake-meta"><span>◷ ${esc(fmtTime(e.time))} · ${esc(timeAgo(e.time))}</span><span>↗ ${Math.round(dist(e))} km</span><span>↓ ${Number(e.depth).toFixed(0)} km prof.</span></div>
          <div class="quake-links">${link}<a href="https://www.openstreetmap.org/?mlat=${e.lat}&mlon=${e.lon}#map=8/${e.lat}/${e.lon}" target="_blank" rel="noopener">Mapa ↗</a></div></div></article>`;
      }).join('') + (events.length > 100 ? `<div class="empty">Mostrando 100 de ${events.length}. Sube la magnitud mínima para ver menos.</div>` : '');
    }
    if (state.map) {
      state.markers.clearLayers();
      events.slice(0, 300).forEach((e) => {
        const color = e.mag >= 5 ? '#ff626d' : e.mag >= 3.5 ? '#ffb454' : '#63d5a1';
        const recent = Date.now() - e.time < 3600000;
        L.circleMarker([e.lat, e.lon], { radius: Math.max(5, Math.min(22, 4 + e.mag * 2)), weight: recent ? 4 : 2, color: recent ? '#ffffff' : color, fillColor: color, fillOpacity: 0.72 })
          .bindPopup(`<strong>M ${e.mag.toFixed(1)}</strong><br>${esc(e.place)}<br>${esc(fmtTime(e.time))}<br>Prof.: ${Number(e.depth).toFixed(0)} km<br><small>${esc(sourceLine(e))}</small>`)
          .addTo(state.markers);
      });
      if (state.userMarker) state.userMarker.setLatLng([state.center.lat, state.center.lon]);
    }
  }

  // ---------- Réplicas ----------
  function renderSequence() {
    const panel = $('seqPanel');
    const seq = Core.findSequence(state.events, Date.now());
    if (!seq) { panel.hidden = true; return; }
    panel.hidden = false;
    const m = seq.main;
    $('seqSubtitle').textContent = `Sismo principal: M ${m.mag.toFixed(1)} · ${m.place} · ${timeAgo(m.time)} (réplicas = M ${seq.countMinMag.toFixed(1)}+ a menos de ${seq.radiusKm} km)`;
    const label = { bajando: 'RITMO BAJANDO', subiendo: 'RITMO SUBIENDO', estable: 'RITMO ESTABLE', insuficiente: 'MUY RECIENTE' }[seq.trend];
    $('seqTrend').textContent = label;
    $('seqTrend').style.color = seq.trend === 'subiendo' ? 'var(--red)' : seq.trend === 'bajando' ? 'var(--green)' : '';
    const big = seq.largest;
    $('seqNumbers').innerHTML =
      `<div><strong>${seq.after.length}</strong><span>réplicas en total</span></div>` +
      `<div><strong>${seq.last6}</strong><span>últimas 6 h</span></div>` +
      `<div><strong>${seq.prev6}</strong><span>6 h anteriores</span></div>` +
      `<div><strong>${big ? big.mag.toFixed(1) : '—'}</strong><span>${big ? 'mayor réplica · ' + esc(timeAgo(big.time)) : 'mayor réplica'}</span></div>`;
    $('seqNote').textContent = seq.trend === 'bajando' ? 'Después de un sismo grande las réplicas suelen hacerse menos frecuentes con el tiempo, y aquí ocurre eso. Pero siguen siendo posibles réplicas fuertes: mantén tu plan de seguridad y sigue a SINAPROC.'
      : seq.trend === 'subiendo' ? 'El número de réplicas por hora está subiendo. Mantente atento a la información de SINAPROC y ten tu plan de seguridad a mano.'
      : seq.trend === 'estable' ? 'El ritmo de réplicas se mantiene parecido. Esto es un conteo de lo ya ocurrido, no una predicción.'
      : 'Aún es pronto (menos de 12 horas) para saber si el ritmo baja. Esto es un conteo de lo ya ocurrido, no una predicción.';
    const max = Math.max(1, ...seq.hourly);
    $('seqChart').innerHTML = seq.hourly.map((n, i) => `<i style="height:${Math.round((n / max) * 100)}%" title="${n} réplica${n === 1 ? '' : 's'} · hace ${23 - i} h"></i>`).join('');
  }

  // ---------- Mapa ----------
  function initMap() {
    if (!window.L) { $('map').innerHTML = '<div class="empty">No se pudo cargar el mapa (Leaflet). Revisa tu conexión.</div>'; return; }
    state.map = L.map('map', { scrollWheelZoom: false }).setView([8.2, -80.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(state.map);
    state.markers = L.layerGroup().addTo(state.map);
    state.userMarker = L.circleMarker([state.center.lat, state.center.lon], { radius: 7, color: '#62d6e8', fillColor: '#62d6e8', fillOpacity: 1, weight: 3 }).bindPopup('Centro usado para calcular distancias').addTo(state.map);
  }

  // ---------- Sonido y alarma ----------
  function audioContext() {
    if (!state.audio) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) state.audio = new AC(); }
    if (state.audio && state.audio.state === 'suspended') state.audio.resume().catch(() => {});
    return state.audio;
  }
  function beep(freq, duration, offset, gain = 0.48, endFreq = null) {
    const ac = audioContext(); if (!ac) return;
    const osc = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + offset;
    osc.type = 'square'; osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.setValueAtTime(gain, t + duration * 0.72); g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g); g.connect(ac.destination); osc.start(t); osc.stop(t + duration + 0.03);
  }
  function alarmBurst() {
    try { beep(740, .22, 0, .42, 1120); beep(1120, .22, .26, .46, 680); beep(760, .22, .52, .46, 1180); beep(1180, .22, .78, .46, 700); beep(820, .4, 1.04, .48, 1250); beep(1250, .36, 1.48, .48, 760); } catch (e) { console.warn(e); }
    if ('vibrate' in navigator) navigator.vibrate([500, 120, 500, 120, 800]);
  }
  // Sonido propio (config.js > ALARM_SOUND). Si no existe o falla, se usa la alarma sintetizada de arriba.
  async function loadAlarmSample() {
    if (!C.ALARM_SOUND || state.alarmBuffer !== undefined) return;
    state.alarmBuffer = null;
    try {
      const ac = audioContext(); if (!ac) return;
      const r = await fetch(C.ALARM_SOUND); if (!r.ok) throw new Error(`HTTP ${r.status}`);
      state.alarmBuffer = await ac.decodeAudioData(await r.arrayBuffer());
    } catch (err) { console.info('Sonido personalizado no disponible, se usa la alarma sintetizada:', err.message || err); }
  }
  function startAlarm() {
    if (!state.soundOn) return; stopAlarm();
    const ac = audioContext();
    if (state.alarmBuffer && ac) {
      const src = ac.createBufferSource(); src.buffer = state.alarmBuffer; src.loop = true;
      const g = ac.createGain(); g.gain.value = 1; src.connect(g); g.connect(ac.destination); src.start();
      state.alarmSource = src;
      const buzz = () => { if ('vibrate' in navigator) navigator.vibrate([500, 120, 500, 120, 800]); };
      buzz(); state.alarmTimer = setInterval(buzz, 2200);
    } else { alarmBurst(); state.alarmTimer = setInterval(alarmBurst, 2200); }
  }
  function stopAlarm() {
    if (state.alarmTimer) { clearInterval(state.alarmTimer); state.alarmTimer = null; }
    if (state.alarmSource) { try { state.alarmSource.stop(); } catch (_) {} state.alarmSource = null; }
    if ('vibrate' in navigator) navigator.vibrate(0);
  }

  // En Android las notificaciones hay que pedirlas al service worker; "new Notification()" falla allí.
  async function systemNotify(title, body, tag, url) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = { body, tag, renotify: true, requireInteraction: true, vibrate: [700, 200, 700, 200, 1000], icon: 'icons/notif-icon-192.png', badge: 'icons/badge-96.png', data: { url: url || './' } };
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) await reg.showNotification(title, opts); else new Notification(title, opts);
    } catch (err) { console.warn('Notificación:', err); }
  }

  function showAlertModal({ title, mag, text, safety }) {
    $('alertTitle').textContent = title; $('alertMag').textContent = mag; $('alertText').textContent = text;
    $('alertSafety').textContent = safety || 'Este aviso llega DESPUÉS de que el sismo ocurrió: no es alerta temprana y no da tiempo de ponerse a salvo. Si sientes movimiento: agáchate, cúbrete y sujétate. Sigue las indicaciones de SINAPROC.';
    $('alertBackdrop').classList.add('show'); startAlarm();
  }
  function triggerAlert(e, kind) {
    const where = `${e.place}. Hora local: ${fmtTime(e.time)} (${timeAgo(e.time)}). A unos ${Math.round(dist(e))} km de ${state.center.label}. Profundidad: ${Number(e.depth).toFixed(0)} km.`;
    const tsu = e.tsunami ? ' USGS marca este evento con posible aviso de tsunami: revisa las instrucciones oficiales.' : '';
    showAlertModal({
      title: kind === 'upgraded' ? 'MAGNITUD CORREGIDA AL ALZA' : 'SISMO REPORTADO',
      mag: `M ${e.mag.toFixed(1)}`,
      text: `${where} Fuentes: ${sourceLine(e)}.${tsu}`
    });
    systemNotify(`Sismo reportado · M ${e.mag.toFixed(1)}`, `${e.place}. ${sourceLine(e)}`, e.id, './');
    updateVigil(e);
  }
  function triggerClusterAlert(event) {
    if (state.lastClusterIds.has(event.id)) return; state.lastClusterIds.add(event.id);
    showAlertModal({
      title: 'POSIBLE SACUDIDA CONFIRMADA POR VARIOS MÓVILES', mag: 'DETECCIÓN EXPERIMENTAL',
      text: `El servidor recibió un grupo de ${event.count} detecciones de movimiento cerca de tu zona. No confirma que sea un terremoto; podría tratarse de otros movimientos.`,
      safety: 'Experimento comunitario sin validación sismológica; no lo tomes como aviso oficial. Si sientes movimiento: agáchate, cúbrete y sujétate.'
    });
    systemNotify('Posible movimiento · experimental', `${event.count} móviles reportaron movimiento en la zona. No es confirmación oficial.`, event.id, './');
  }
  async function setSound(on) {
    state.soundOn = on;
    const btn = $('soundBtn');
    if (on) {
      audioContext(); loadAlarmSample(); btn.classList.add('enabled'); btn.textContent = '✓ Alertas activadas';
      if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (_) {} }
      alarmBurst();
    } else { btn.classList.remove('enabled'); btn.textContent = '♬ Activar alertas'; stopAlarm(); }
  }

  // ---------- Modo vigilia ----------
  async function acquireWakeLock() {
    const el = $('vigilWake');
    if (!('wakeLock' in navigator)) { el.textContent = 'Este navegador no puede mantener la pantalla encendida: en Ajustes del teléfono pon el tiempo de apagado de pantalla al máximo.'; return; }
    try {
      state.wakeLock = await navigator.wakeLock.request('screen');
      state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
      el.textContent = '✓ La pantalla se mantendrá encendida.';
    } catch (err) { el.textContent = 'No se pudo mantener la pantalla encendida (¿ahorro de batería activado?). Desactívalo o sube el tiempo de apagado de pantalla.'; }
  }
  async function enterVigil() {
    if (!state.soundOn) await setSound(true); else { audioContext(); }
    state.vigil = true; state.connBeeped = false;
    $('vigil').hidden = false; document.body.classList.add('vigil-open');
    await acquireWakeLock();
    try { await document.documentElement.requestFullscreen?.(); } catch (_) {}
    tickVigil(); state.vigilTimer = setInterval(tickVigil, 1000);
    scheduleNext(true);
  }
  function exitVigil() {
    state.vigil = false; $('vigil').hidden = true; document.body.classList.remove('vigil-open');
    clearInterval(state.vigilTimer); state.vigilTimer = null;
    if (state.wakeLock) { state.wakeLock.release().catch(() => {}); state.wakeLock = null; }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    scheduleNext(true);
  }
  function tickVigil() {
    const now = new Date();
    $('vigilClock').textContent = new Intl.DateTimeFormat('es-PA', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Panama' }).format(now);
    // Si dejamos de recibir datos, hay que decirlo: una falsa tranquilidad es peor que una alarma.
    const lost = Date.now() - state.lastOk > (C.CONN_LOST_SECONDS || 150) * 1000;
    $('vigilConn').hidden = !lost;
    if (lost && !state.connBeeped) { state.connBeeped = true; beep(440, .5, 0, .25); }
    if (!lost) state.connBeeped = false;
  }
  function updateVigil(lastAlerted) {
    if (!state.vigil) return;
    const last = state.events[0];
    $('vigilStatus').textContent = `Vigilando · alerta desde M ${settings.alertMag.toFixed(1)}${settings.useRadius ? ' a ≤' + settings.radius + ' km' : ''} · última consulta ${state.lastPoll ? fmtTime(state.lastPoll) : '—'}`;
    $('vigilLast').textContent = last ? `Último sismo en la región: M ${last.mag.toFixed(1)} · ${last.place} · ${timeAgo(last.time)}` : 'Sin sismos recientes en la región.';
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { if (state.vigil && !state.wakeLock) acquireWakeLock(); refresh(); }
    scheduleNext(true);
  });

  // ---------- Programar consultas ----------
  function scheduleNext(reset) {
    if (reset && state.pollTimer) clearTimeout(state.pollTimer);
    if (!reset && state.pollTimer) return;
    const secs = document.hidden ? (C.POLL_SECONDS_HIDDEN || 120) : (state.vigil ? C.POLL_SECONDS_VIGILIA : C.POLL_SECONDS);
    const igcSecs = document.hidden ? (C.IGC_POLL_SECONDS_HIDDEN || 180) : (state.vigil ? (C.IGC_POLL_SECONDS_VIGILIA || 30) : (C.IGC_POLL_SECONDS || 60));
    $('pollEvery').textContent = `USGS ${secs} s · IGC-UP ${igcSecs} s`; 
    state.pollTimer = setTimeout(async () => { state.pollTimer = null; await refresh(); scheduleNext(); }, secs * 1000);
  }

  // ---------- Sensor del teléfono (experimental, sin cambios de lógica) ----------
  function sensorMagnitude(ev) {
    let x, y, z; const a = ev.acceleration;
    if (a && Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z)) { x = a.x; y = a.y; z = a.z; }
    else {
      const g = ev.accelerationIncludingGravity; if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y) || !Number.isFinite(g.z)) return null;
      if (!state.sensorLowPass) state.sensorLowPass = { x: g.x, y: g.y, z: g.z };
      const lp = state.sensorLowPass, alpha = 0.88;
      lp.x = alpha * lp.x + (1 - alpha) * g.x; lp.y = alpha * lp.y + (1 - alpha) * g.y; lp.z = alpha * lp.z + (1 - alpha) * g.z;
      x = g.x - lp.x; y = g.y - lp.y; z = g.z - lp.z;
    }
    return Math.sqrt(x * x + y * y + z * z);
  }
  function onDeviceMotion(ev) {
    if (!state.sensorOn) return;
    const peak = sensorMagnitude(ev); if (peak === null) return;
    $('sensorPeak').textContent = `${peak.toFixed(2)} m/s²`; $('sensorMeter').style.width = `${Math.min(100, peak / 15 * 100)}%`;
    const now = Date.now(); state.sensorSamples.push({ t: now, peak }); state.sensorSamples = state.sensorSamples.filter((s) => now - s.t < 1600);
    const high = state.sensorSamples.filter((s) => s.peak >= 4.2);
    if (high.length >= 4 && now - state.lastSensorPing > 15000) {
      state.lastSensorPing = now;
      $('sensorEvent').textContent = `Sacudida brusca detectada localmente (${peak.toFixed(1)} m/s²). Puede ser un movimiento del teléfono; no confirma un sismo.`;
      $('sensorStatus').textContent = 'Sensor activo · comprobando patrón de movimiento';
      if ('vibrate' in navigator) navigator.vibrate([100, 60, 100]);
      if (state.sensorShare) sendMotionPing(peak);
    }
  }
  async function startSensor() {
    if (!('DeviceMotionEvent' in window)) { $('sensorStatus').textContent = 'Este navegador o dispositivo no expone el acelerómetro a la página.'; return; }
    try {
      if (!window.isSecureContext) throw new Error('Los sensores requieren HTTPS o localhost.');
      if (typeof DeviceMotionEvent.requestPermission === 'function') { const p = await DeviceMotionEvent.requestPermission(); if (p !== 'granted') throw new Error('Permiso de movimiento denegado'); }
      state.sensorOn = true; state.sensorLowPass = null; state.sensorSamples = [];
      window.addEventListener('devicemotion', onDeviceMotion, { passive: true });
      $('sensorBtn').disabled = true; $('sensorBtn').textContent = '✓ Sensor activo'; $('sensorResetBtn').disabled = false;
      $('sensorBadge').textContent = 'ACTIVO'; $('sensorBadge').style.color = 'var(--green)';
      $('sensorStatus').textContent = 'Sensor activo en primer plano. Deja el móvil quieto sobre una superficie estable para probarlo.';
      if (state.sensorShare) startClusterPolling();
    } catch (err) { $('sensorStatus').textContent = `No se pudo activar: ${err.message || err}. En iPhone y algunos navegadores el permiso debe aceptarse al pulsar el botón; usa una página HTTPS.`; }
  }
  function stopSensor() {
    state.sensorOn = false; window.removeEventListener('devicemotion', onDeviceMotion);
    if (state.clusterPollTimer) { clearInterval(state.clusterPollTimer); state.clusterPollTimer = null; }
    $('sensorBtn').disabled = false; $('sensorBtn').textContent = '◎ Activar acelerómetro'; $('sensorResetBtn').disabled = true;
    $('sensorBadge').textContent = 'INACTIVO'; $('sensorBadge').style.color = ''; $('sensorStatus').textContent = 'Sensor apagado.';
    $('sensorMeter').style.width = '0%'; $('sensorPeak').textContent = '— m/s²';
  }
  function shareCommunityChanged() {
    state.sensorShare = $('shareNetwork').checked;
    if (!state.sensorShare) {
      state.sensorCoords = null; if (state.clusterPollTimer) { clearInterval(state.clusterPollTimer); state.clusterPollTimer = null; }
      $('sensorStatus').textContent = state.sensorOn ? 'Sensor local activo; participación comunitaria desactivada.' : 'Participación comunitaria desactivada.'; return;
    }
    if (!navigator.geolocation) { state.sensorShare = false; $('shareNetwork').checked = false; alert('Este navegador no permite la ubicación necesaria para la función comunitaria.'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      state.sensorCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      $('sensorStatus').textContent = 'Participación activada. La ubicación solo se adjuntará al detectar una sacudida.';
      if (state.sensorOn) startClusterPolling();
    }, () => { state.sensorShare = false; $('shareNetwork').checked = false; alert('No se obtuvo permiso de ubicación. La participación comunitaria seguirá desactivada.'); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }
  function getSessionDeviceId() {
    try { let id = sessionStorage.getItem('sismoPanamaDeviceSession'); if (!id) { id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`; sessionStorage.setItem('sismoPanamaDeviceSession', id); } return id; }
    catch (_) { return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  }
  async function sendMotionPing(peak) {
    if (!state.sensorShare || !state.sensorCoords) return;
    try {
      const r = await fetch('api/motion-ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent: true, deviceId: getSessionDeviceId(), lat: state.sensorCoords.lat, lon: state.sensorCoords.lon, peak, at: Date.now() }) });
      if (!r.ok) throw new Error('Servidor no disponible');
      const data = await r.json();
      if (data.candidate) { $('sensorEvent').textContent = `El servidor agrupó ${data.count} detecciones cercanas. Alerta todavía experimental.`; triggerClusterAlert(data.event || { id: `motion-${Date.now()}`, count: data.count }); }
    } catch (_) { $('sensorEvent').textContent = 'Sacudida local detectada. El servidor comunitario no está disponible; no se envió la detección.'; }
  }
  async function pollMotionClusters() {
    if (!state.sensorShare || !state.sensorCoords || !state.sensorOn) return;
    try {
      const q = new URLSearchParams({ lat: state.sensorCoords.lat, lon: state.sensorCoords.lon });
      const r = await fetch(`api/motion-status?${q}`, { cache: 'no-store' }); if (!r.ok) return;
      const data = await r.json(); if (data.events) for (const event of data.events) triggerClusterAlert(event);
    } catch (_) {}
  }
  function startClusterPolling() { if (state.clusterPollTimer) clearInterval(state.clusterPollTimer); pollMotionClusters(); const seconds = Math.max(15, Number(C.MOTION_CLUSTER_POLL_SECONDS || 15)); state.clusterPollTimer = setInterval(pollMotionClusters, seconds * 1000); }

  // ---------- Instalar como app ----------
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault(); state.installPrompt = ev; $('installBtn').hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    state.installPrompt = null; $('installBtn').hidden = true;
    console.info('Sismo Panamá se instaló correctamente.');
  });
  $('installBtn').addEventListener('click', async () => {
    if (state.installPrompt) {
      try {
        state.installPrompt.prompt();
        const choice = await state.installPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') $('installBtn').hidden = true;
      } catch (err) { console.warn('Instalación PWA:', err); }
      state.installPrompt = null;
      return;
    }
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isInStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isInStandalone) {
      alert('Sismo Panamá ya está abierta como aplicación instalada.');
    } else if (isIOS) {
      alert('Para instalar Sismo Panamá en iPhone/iPad:\n1. Abre este enlace en Safari (no dentro de otra app).\n2. Toca Compartir.\n3. Elige “Añadir a pantalla de inicio”.\n\nNecesitas conexión HTTPS. Las notificaciones remotas aún deben configurarse en el servidor.');
    } else {
      alert('Para instalar Sismo Panamá:\n1. Abre el enlace HTTPS publicado en Chrome o Edge.\n2. Abre el menú ⋮ del navegador.\n3. Selecciona “Instalar aplicación” o “Añadir a pantalla de inicio”.\n\nComparte el enlace de GitHub Pages (https://TU_USUARIO.github.io/sismo-panama/), no el enlace del repositorio. Las notificaciones remotas deben configurarse aparte; GitHub Pages no las envía por sí solo.');
    }
  });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    let reloadingForWorkerUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingForWorkerUpdate) return;
      reloadingForWorkerUpdate = true;
      window.location.reload();
    });
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI), { updateViaCache: 'none' })
      .then((reg) => {
        reg.update().catch(() => {});
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      })
      .catch((err) => console.warn('Service Worker:', err));
  }

  // ---------- Controles ----------
  async function locateMe() {
    if (!navigator.geolocation) { alert('Este navegador no permite geolocalización.'); return; }
    $('locBtn').disabled = true; $('locBtn').textContent = 'Buscando…';
    const done = () => { $('locBtn').disabled = false; $('locBtn').textContent = '◎ Mi ubicación'; };
    navigator.geolocation.getCurrentPosition((pos) => {
      state.center = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'tu ubicación' };
      settings.useRadius = true; saveSettings(); $('centerLabel').textContent = 'Centro: tu ubicación'; done();
      if (state.map) state.map.setView([state.center.lat, state.center.lon], 7);
      render(); renderSequence();
    }, () => { alert('No se pudo obtener la ubicación. Da permiso al navegador y asegúrate de abrir la página desde HTTPS o localhost.'); done(); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }
  $('period').addEventListener('change', () => { settings.period = $('period').value; saveSettings(); render(); });
  $('minMag').addEventListener('change', () => { settings.minMag = Number($('minMag').value); $('magRead').textContent = settings.minMag === 0 ? 'Cualquiera' : `${settings.minMag.toFixed(1)}+`; saveSettings(); render(); });
  $('alertMagThreshold').addEventListener('change', () => { settings.alertMag = Number($('alertMagThreshold').value); saveSettings(); updateVigil(); });
  $('radius').addEventListener('input', () => { settings.radius = Number($('radius').value); $('radiusRead').textContent = `${settings.radius} km`; saveSettings(); render(); });
  $('search').addEventListener('input', () => { settings.search = $('search').value; render(); });
  $('refreshBtn').addEventListener('click', () => refresh());
  $('soundBtn').addEventListener('click', () => setSound(!state.soundOn));
  $('locBtn').addEventListener('click', locateMe);
  $('vigilBtn').addEventListener('click', enterVigil);
  $('vigilExit').addEventListener('click', exitVigil);
  $('allRegionsBtn').addEventListener('click', () => { settings.useRadius = false; settings.search = ''; $('search').value = ''; $('centerLabel').textContent = 'Centro: radio desactivado'; saveSettings(); render(); });
  $('testBtn').addEventListener('click', async () => {
    // Prueba el sonido REAL de la alarma durante 4 s (suena aunque las alertas no estén activadas).
    audioContext(); await loadAlarmSample();
    const was = state.soundOn; state.soundOn = true; startAlarm(); state.soundOn = was;
    setTimeout(() => { if (!$('alertBackdrop').classList.contains('show')) stopAlarm(); }, 4000);
  });
  $('simBtn').addEventListener('click', () => {
    // Prueba completa SIN datos reales: ventana + sonido + notificación del sistema.
    if (!state.soundOn) setSound(true);
    triggerAlert(Core.buildEvent([{ source: 'PRUEBA', mag: 6.0, lat: state.center.lat, lon: state.center.lon, depth: 10, time: new Date(), updated: new Date(), place: 'SIMULACIÓN · esto es una prueba', status: 'SIMULADO', url: './', tsunami: false }]), 'new');
  });
  $('dismissAlert').addEventListener('click', () => { $('alertBackdrop').classList.remove('show'); stopAlarm(); });
  $('sensorBtn').addEventListener('click', startSensor); $('sensorResetBtn').addEventListener('click', stopSensor); $('shareNetwork').addEventListener('change', shareCommunityChanged);

  // ---------- Inicio ----------
  if (!C.ENABLE_COMMUNITY) document.querySelectorAll('.share-option,.sensor-footnote').forEach((el) => { el.hidden = true; });
  loadSettings(); initMap();
  refresh().then(() => scheduleNext());
  setInterval(() => { updateSourceAges(); render(); renderSequence(); }, 60000); // actualiza antigüedad de datos y "hace X min"
})();
