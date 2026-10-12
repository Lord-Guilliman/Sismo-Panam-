// Sismo Panamá v0.7.1 — Ajustes públicos (nunca pongas secretos aquí).
window.SISMO_CONFIG = {
  // De dónde sale la tabla del IGC-UP.
  // - En GitHub Pages: deja '' y el navegador intentará consultar IGC-UP directamente.
  //   Si IGC-UP bloquea CORS, configura la URL del Cloudflare Worker descrito en PUBLICAR.md.
  // - En el servidor local de desarrollo, app.js detecta localhost y usa /api/igc automáticamente.
  IGC_PROXY: '',

  // API opcional para notificaciones Web Push con backend propio.
  // Déjalo vacío mientras no hayas desplegado y auditado el backend; la interfaz lo indicará.
  PUSH_API_BASE: '',

  // Rectángulo donde buscamos sismos en USGS (Panamá y alrededores).
  REGION: { minLat: 3, maxLat: 12.5, minLon: -87, maxLon: -74 },

  // Cada cuántos segundos se consulta (USGS ligero / IGC-UP).
  // OJO con valores muy bajos: cada teléfono abierto consulta a esta frecuencia. Con muchos usuarios
  // a largo plazo conviene un vigilante central y notificaciones push (ver PUBLICAR.md).
  POLL_SECONDS: 30,
  POLL_SECONDS_VIGILIA: 15,
  IGC_POLL_SECONDS: 60,
  IGC_POLL_SECONDS_VIGILIA: 30,
  IGC_POLL_SECONDS_HIDDEN: 180,
  // Si el proxy del IGC-UP falla varias veces seguidas (p. ej. se acabó la cuota gratuita), se consulta menos.
  IGC_BACKOFF_SECONDS: 180,
  // Con la pestaña oculta (y sin modo vigilia) se consulta con menor frecuencia.
  POLL_SECONDS_HIDDEN: 120,
  // Solo aplica al experimento de grupos de movimiento, no al catálogo sísmico.
  MOTION_CLUSTER_POLL_SECONDS: 15,

  // Detección comunitaria por acelerómetro (los móviles reportan sacudidas a un servidor). DESACTIVADA:
  // cualquiera podría enviar datos falsos y provocar falsas alarmas. Los avisos salen SOLO de USGS e IGC-UP.
  ENABLE_COMMUNITY: false,

  // En modo vigilia, si pasan tantos segundos sin poder consultar ninguna fuente se avisa en rojo.
  CONN_LOST_SECONDS: 300,

  // Sonido de la alarma (mp3/ogg en la carpeta sounds/). Si el archivo no existe se usa una alarma sintetizada.
  // alerta_libre.mp3 es el sonido distribuible. El audio personal alerta.mp3 no forma parte de esta versión.
  ALARM_SOUND: '', // En este paquete de prueba se usa el tono sintetizado; el audio externo se excluyó hasta verificar su licencia.

  // Un sismo más viejo que esto (horas) no hace sonar la alarma, solo aparece en la lista.
  MAX_ALERT_AGE_HOURS: 6,

  // Alarma automática SIEMPRE si la magnitud llega a este valor en la región, aunque esté lejos.
  ALWAYS_ALERT_MAG: 6.0
};
