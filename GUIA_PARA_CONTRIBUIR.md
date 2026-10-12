# Guía rápida para contribuir

Este archivo es una guía simplificada para comenzar. La política completa está en [CONTRIBUTING.md](CONTRIBUTING.md).

| Quiero cambiar… | Archivo principal |
|---|---|
| Textos y secciones | `index.html` |
| Colores y presentación | `styles.css` |
| Intervalos y umbrales públicos | `config.js` |
| Unión/deduplicación de eventos | `core.js` y `tests/pruebas.html` |
| Mapa, sonido, modo vigilia | `app.js` |
| Activación Web Push desde el navegador | `push-client.js` |
| Caché PWA y recepción de mensajes push | `sw.js` |
| API local de desarrollo | `server.py` |
| Proxy opcional IGC-UP | `cloudflare_worker.js` |
| Envío remoto de notificaciones | `backend/` (no `server.py`) |

Reglas mínimas: no subas secretos; no actives acelerómetros comunitarios como fuente de alerta; no elimines avisos de que la app no es oficial; prueba todos los cambios. Para fallos de seguridad, sigue `SECURITY.md` y no abras una issue pública con detalles explotables.
