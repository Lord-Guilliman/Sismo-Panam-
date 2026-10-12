// core.js — Lógica "pura" de Sismo Panamá (sin tocar la pantalla).
// Aquí viven las reglas que más importan: leer las fuentes, unir reportes del
// mismo sismo y decidir qué es nuevo. Al estar separado de la interfaz se puede
// probar con datos simulados (carpeta tests/).
(function (root) {
  'use strict';

  const IGC_PAGE_URL = 'https://sismosgeociencias.up.ac.pa/';
  // Reglas para decidir que dos reportes son del MISMO sismo.
  const MATCH = { maxSeconds: 90, maxKm: 120, maxMagDiff: 1.5 };
  // Para decidir si un sismo ya lo habíamos avisado somos más permisivos (evita alarmas repetidas).
  const KNOWN = { maxSeconds: 150, maxKm: 150 };

  function distKm(aLat, aLon, bLat, bLon) {
    const R = 6371, rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  // ---------- USGS ----------
  const DIRS = { N: 'N', NNE: 'NNE', NE: 'NE', ENE: 'ENE', E: 'E', ESE: 'ESE', SE: 'SE', SSE: 'SSE', S: 'S', SSW: 'SSO', SW: 'SO', WSW: 'OSO', W: 'O', WNW: 'ONO', NW: 'NO', NNW: 'NNO' };
  // "25 km NW of Tonosí, Panama" -> "a 25 km al NO de Tonosí, Panama"
  function placeEs(place) {
    const m = String(place || '').match(/^(\d+)\s*km\s+([NSEW]{1,3})\s+of\s+(.+)$/i);
    if (!m) return place || 'Ubicación no especificada';
    return `a ${m[1]} km al ${DIRS[m[2].toUpperCase()] || m[2]} de ${m[3]}`;
  }

  function usgsToReport(feature) {
    const c = (feature.geometry && feature.geometry.coordinates) || [];
    const p = feature.properties || {};
    const lat = Number(c[1]), lon = Number(c[0]);
    const mag = Number(p.mag);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(mag) || !p.time) return null;
    return {
      source: 'USGS', rawId: String(feature.id), mag, lat, lon,
      depth: Number.isFinite(Number(c[2])) ? Number(c[2]) : 0,
      time: new Date(p.time), updated: new Date(p.updated || p.time),
      place: placeEs(p.place), status: p.status === 'reviewed' ? 'REVISADO' : 'AUTOMÁTICO',
      url: p.url || 'https://earthquake.usgs.gov/earthquakes/map/',
      tsunami: Number(p.tsunami || 0) === 1
    };
  }

  // ---------- IGC-UP ----------
  function normalizeTime(s) {
    const t = String(s || '').trim().toUpperCase();
    let m = t.match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/);
    if (m) { let h = Number(m[1]) % 12; if (m[4] === 'PM') h += 12; return `${String(h).padStart(2, '0')}:${m[2]}:${m[3]}`; }
    m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}:${m[3] || '00'}`;
    return null;
  }

  // Lee la tabla pública del IGC-UP. DOMParserCtor permite usarla también en pruebas con Node.
  function parseIgcRows(htmlText, DOMParserCtor, baseUrl) {
    const Parser = DOMParserCtor || root.DOMParser;
    const doc = new Parser().parseFromString(htmlText, 'text/html');
    const out = [], seen = new Set();
    for (const row of doc.querySelectorAll('table tr')) {
      const cells = [...row.querySelectorAll('th,td')].map((c) => c.textContent.trim().replace(/\s+/g, ' '));
      if (cells.length < 8) continue;
      // Columnas: estado, fecha, hora local, latitud, longitud, profundidad, magnitud, región, mapa
      const [status, date, clock, lat, lon, depth, mag, place] = cells;
      const latitude = Number(lat.replace(',', '.')), longitude = Number(lon.replace(',', '.')), magnitude = Number(mag.replace(',', '.'));
      const hhmmss = normalizeTime(clock);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !hhmmss) continue;
      if (![latitude, longitude, magnitude].every(Number.isFinite)) continue;
      // La hora del IGC-UP es hora local de Panamá (UTC-5, sin horario de verano).
      // Se escribe el desfase a propósito: así funciona igual si el navegador está en otra zona horaria.
      const time = new Date(`${date}T${hhmmss}-05:00`);
      if (Number.isNaN(time.getTime())) continue;
      const rawId = `${date}-${clock}-${latitude}-${longitude}-${magnitude}`;
      if (seen.has(rawId)) continue;
      seen.add(rawId);
      const anchor = row.querySelector('a[href]');
      let url = IGC_PAGE_URL;
      try { if (anchor) { const u = new URL(anchor.getAttribute('href'), baseUrl || IGC_PAGE_URL); if (/^https?:$/.test(u.protocol)) url = u.href; } } catch (_) {}
      out.push({
        source: 'IGC-UP', rawId, mag: magnitude, lat: latitude, lon: longitude, depth: parseFloat(depth) || 0,
        time, updated: time, place: String(place || '').replace(/^Localizado en /i, '') || 'Evento reportado por IGC-UP',
        status: (status || 'REPORTADO').toUpperCase(), url, tsunami: false
      });
    }
    return out;
  }

  // El IGC-UP a veces publica el mismo sismo dos veces: PRELIMINAR y luego REVISADO.
  // Si hay un REVISADO muy parecido, descartamos el preliminar.
  function dropSupersededPreliminary(list) {
    const revised = list.filter((e) => e.status === 'REVISADO');
    return list.filter((e) => {
      if (e.status !== 'PRELIMINAR') return true;
      return !revised.some((r) => Math.abs(r.time - e.time) <= 180000 && distKm(r.lat, r.lon, e.lat, e.lon) <= 30 && Math.abs(r.mag - e.mag) <= 0.5);
    });
  }

  // ---------- Unir fuentes ----------
  // Une USGS + IGC-UP: un sismo que ambos reportan se muestra UNA vez, con los dos reportes.
  function mergeSources(usgsList, igcList) {
    const igc = dropSupersededPreliminary(igcList);
    const pairs = [];
    usgsList.forEach((u, i) => igc.forEach((g, j) => {
      const dt = Math.abs(u.time - g.time) / 1000;
      if (dt > MATCH.maxSeconds || Math.abs(u.mag - g.mag) > MATCH.maxMagDiff) return;
      const d = distKm(u.lat, u.lon, g.lat, g.lon);
      if (d > MATCH.maxKm) return;
      pairs.push({ i, j, score: dt + d * 0.4 });
    }));
    pairs.sort((a, b) => a.score - b.score);
    const usedU = new Set(), usedG = new Set(), groups = [];
    for (const p of pairs) {
      if (usedU.has(p.i) || usedG.has(p.j)) continue;
      usedU.add(p.i); usedG.add(p.j);
      groups.push([usgsList[p.i], igc[p.j]]);
    }
    usgsList.forEach((u, i) => { if (!usedU.has(i)) groups.push([u]); });
    igc.forEach((g, j) => { if (!usedG.has(j)) groups.push([g]); });
    return groups.map(buildEvent).sort((a, b) => b.time - a.time);
  }

  // Un "evento" = un sismo con uno o más reportes.
  function buildEvent(reports) {
    // Ubicación/hora: preferimos IGC-UP revisado > USGS > IGC-UP preliminar.
    const rank = (r) => (r.source === 'IGC-UP' && r.status === 'REVISADO' ? 0 : r.source === 'USGS' ? 1 : 2);
    const lead = [...reports].sort((a, b) => rank(a) - rank(b))[0];
    const igcReport = reports.find((r) => r.source === 'IGC-UP');
    const usgsReport = reports.find((r) => r.source === 'USGS');
    const mag = Math.max(...reports.map((r) => r.mag)); // se muestra la mayor; cada fuente se ve en su etiqueta
    return {
      id: 'ev:' + Math.round(Math.min(...reports.map((r) => r.time.getTime())) / 1000) + ':' + lead.lat.toFixed(1) + ':' + lead.lon.toFixed(1),
      mag, lat: lead.lat, lon: lead.lon, depth: lead.depth, time: lead.time,
      updated: new Date(Math.max(...reports.map((r) => r.updated.getTime()))),
      place: (igcReport || usgsReport || lead).place,
      tsunami: reports.some((r) => r.tsunami),
      reports: reports.map((r) => ({ source: r.source, mag: r.mag, status: r.status, depth: r.depth, url: r.url })),
      url: lead.url
    };
  }

  // ---------- ¿Es nuevo? ----------
  // "known" es la lista de sismos que ya vimos: [{time, lat, lon, mag}].
  // Un sismo ya conocido NO vuelve a sonar, salvo que su magnitud suba >= 0.5 (corrección al alza).
  const findKnown = (event, known) => known.find((x) => Math.abs(x.time - event.time) <= KNOWN.maxSeconds * 1000 && distKm(x.lat, x.lon, event.lat, event.lon) <= KNOWN.maxKm);
  function classify(event, known) {
    const k = findKnown(event, known);
    if (!k) return 'new';
    return event.mag - k.mag >= 0.5 ? 'upgraded' : 'known';
  }
  function remember(event, known) {
    const k = findKnown(event, known);
    if (k) { k.mag = Math.max(k.mag, event.mag); return; }
    known.push({ time: event.time.getTime ? event.time.getTime() : event.time, lat: event.lat, lon: event.lon, mag: event.mag });
  }

  // ---------- Réplicas ----------
  // Busca el sismo principal reciente (el mayor >= minMainMag en los últimos `days` días)
  // y cuenta las réplicas: eventos posteriores, a <= radiusKm, con M >= countMinMag.
  function findSequence(events, now, opts) {
    const o = Object.assign({ minMainMag: 5.5, days: 30, radiusKm: 150, countMinMag: 3.0 }, opts || {});
    const since = now - o.days * 86400000;
    const mains = events.filter((e) => e.mag >= o.minMainMag && e.time >= since);
    if (!mains.length) return null;
    const main = mains.sort((a, b) => b.mag - a.mag || b.time - a.time)[0];
    const after = events.filter((e) => e !== main && e.time > main.time && e.time <= now && e.mag >= o.countMinMag && distKm(main.lat, main.lon, e.lat, e.lon) <= o.radiusKm);
    const hourly = new Array(24).fill(0);
    for (const e of after) {
      const h = Math.floor((now - e.time) / 3600000);
      if (h >= 0 && h < 24) hourly[23 - h]++;
    }
    const count = (fromH, toH) => after.filter((e) => { const h = (now - e.time) / 3600000; return h >= fromH && h < toH; }).length;
    const last6 = count(0, 6), prev6 = count(6, 12);
    const hoursSince = (now - main.time) / 3600000;
    const largest = after.reduce((m, e) => (!m || e.mag > m.mag ? e : m), null);
    let trend = 'insuficiente';
    if (hoursSince >= 12) trend = last6 < prev6 ? 'bajando' : last6 > prev6 ? 'subiendo' : 'estable';
    return { main, after, hourly, last6, prev6, largest, hoursSince, trend, countMinMag: o.countMinMag, radiusKm: o.radiusKm };
  }

  function magLevel(m) { return m >= 5 ? 'high' : m >= 3.5 ? 'mid' : 'low'; }

  const api = { IGC_PAGE_URL, MATCH, distKm, placeEs, usgsToReport, normalizeTime, parseIgcRows, dropSupersededPreliminary, mergeSources, buildEvent, classify, remember, findSequence, magLevel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SismoCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
