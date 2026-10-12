# Arquitectura de Sismo Panamá

## Componentes

```text
Navegador / PWA (GitHub Pages, HTTPS)
  ├─ app.js + core.js: consulta USGS/IGC-UP, unión/deduplicación, mapa, filtros y alarmas locales
  ├─ sw.js: caché de recursos, modo offline limitado y receptor de eventos Web Push
  └─ push-client.js ── HTTPS ──> backend Web Push (servicio separado)
                                  ├─ API de suscripción y preferencias
                                  ├─ SQLite persistente: endpoints cifrados por el proveedor push + umbral elegido
                                  ├─ monitor central consultando USGS (solo si ENABLE_MONITOR=true)
                                  └─ VAPID privada almacenada fuera del repositorio

Notificador ntfy heredado: `notificador_ntfy.py`; herramienta individual separada, no el backend de la PWA.

Proxy IGC-UP opcional: cloudflare_worker.js (solo lectura; no envía push)
Servidor local server.py: desarrollo; no usar como backend público.
```

## Flujos relevantes

1. **Visualización web:** el navegador consulta USGS e intenta consultar IGC-UP. Si CORS impide la conexión IGC-UP, se puede configurar un proxy de lectura.
2. **Alertas locales:** la página procesa los reportes mientras se ejecuta; el sistema operativo puede suspender el navegador. Intervalos de consulta no equivalen a un tiempo garantizado de entrega.
3. **Web Push remoto:** el usuario concede permiso y el navegador registra una suscripción. `push-client.js` la envía al backend configurado en `PUSH_API_BASE`. El monitor servidor consulta USGS una sola vez por intervalo, decide qué eventos recientes alcanzan el umbral de cada suscripción y envía Web Push con VAPID.
4. **Datos de suscripción:** el backend guarda el endpoint y claves criptográficas que el navegador genera para Web Push, el umbral seleccionado y marcas de tiempo. No guarda la ubicación para la modalidad de push actual. Estos endpoints deben tratarse como secretos operativos.

## Límites de la arquitectura

- GitHub Pages solo aloja archivos estáticos. No ejecuta `server.py`, tareas programadas ni la API Web Push.
- El backend de referencia consulta USGS para el envío remoto; mostrar IGC-UP en la página no implica que sus eventos se incluyan en push.
- El backend usa SQLite y una limitación de solicitudes en memoria; necesita disco persistente y protección de borde para una instancia piloto. No es una arquitectura multi-región ni alta disponibilidad.
- El envío push depende del navegador, de sus servicios push, de los permisos, del sistema operativo, de la red y del proveedor de hosting.
- Las alertas remotas llegan después de que una fuente publica el evento; no son una detección sísmica independiente ni una alerta temprana.

El backend valida que los endpoints Web Push correspondan a dominios conocidos de proveedores (FCM/Google, Apple y Mozilla), lo que reduce el riesgo de SSRF por suscripciones maliciosas. El backend procesa envíos en un pool acotado de 12 trabajadores, con un límite de piloto por defecto de 1.000 suscripciones. Antes de escalar se requieren pruebas de carga, cola de trabajos persistente, medición de latencia y una estrategia de redundancia. El proceso con `ENABLE_MONITOR=true` debe correr como instancia única; múltiples workers del mismo backend pueden producir envíos duplicados.
