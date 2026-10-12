// Sismo Panamá v0.7.1 — proxy opcional de solo lectura para la tabla pública del IGC-UP.
// Despliega como Cloudflare Worker y configura los orígenes exactos que pueden consultarlo.
// NO es un servidor de notificaciones push: GitHub Pages no ejecuta código de servidor.

const IGC_PAGE = 'https://sismosgeociencias.up.ac.pa/';
// Sustituye el dominio de ejemplo por el dominio ORIGEN de tu Pages; no pongas la ruta /sismo-panama/.
const ALLOWED_ORIGINS = [
  'https://TU_USUARIO.github.io'
  // Solo para pruebas locales, agrega temporalmente: 'http://localhost:8000'
  // No mantengas localhost en la lista de una instancia pública si no es necesario.
];
const CACHE_SECONDS = 15;

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');
    const allowed = origin ? ALLOWED_ORIGINS.includes(origin) : false;
    const cors = {
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    };
    if (allowed) cors['Access-Control-Allow-Origin'] = origin;

    // Los fetch cross-origin del navegador envían Origin. Rechaza solicitudes sin Origin
    // para evitar que el proxy quede disponible accidentalmente para clientes genéricos;
    // esto NO es autenticación (un cliente HTTP puede falsificar el encabezado).
    if (!origin || !allowed) return new Response('Origen no autorizado', { status: 403, headers: cors });
    if (request.method === 'OPTIONS') {
      if (!allowed) return new Response('Origen no autorizado', { status: 403, headers: cors });
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') return new Response('Método no permitido', { status: 405, headers: cors });

    try {
      const upstream = await fetch(IGC_PAGE, {
        headers: { 'User-Agent': 'SismoPanama-Proxy/0.7.0', 'Accept': 'text/html' },
        cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
      });
      if (!upstream.ok) return new Response('IGC-UP respondió HTTP ' + upstream.status, { status: 502, headers: cors });
      const html = await upstream.text();
      if (!html || html.length > 2_500_000) return new Response('Respuesta del IGC-UP vacía o demasiado grande', { status: 502, headers: cors });
      return new Response(html, {
        status: 200,
        headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=' + CACHE_SECONDS }
      });
    } catch (_) {
      return new Response('No se pudo consultar el IGC-UP', { status: 502, headers: cors });
    }
  }
};
