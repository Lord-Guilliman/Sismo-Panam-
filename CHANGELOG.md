# Historial de cambios

## v0.7.1 — Preparación de prueba móvil y privacidad

- Se añaden guías detalladas para probar la PWA en el teléfono, publicar el código de forma segura y reducir la exposición de datos del mantenedor.
- Se amplía `.gitignore` para excluir archivos de editor, credenciales, cookies, bases de datos, logs y artefactos locales.
- Se excluyen del paquete de prueba los archivos de configuración de editor y el audio de alarma cuya redistribución no se puede verificar desde el ZIP. La app utiliza el tono sintetizado ya implementado.
- Se añade una hoja de ruta realista hacia una eventual alerta temprana, dejando claro que la versión actual muestra reportes sísmicos posteriores al evento.


## v0.7.0 — Preparación comunitaria y backend push de referencia

- Se incorporan `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `GOVERNANCE.md` y documentación de arquitectura, fuentes, política de alertas, despliegue y recuperación.
- Se añade un backend Web Push opcional con suscripciones, preferencias de magnitud, almacenamiento SQLite, limitación básica de solicitudes y monitor USGS activable por variables de entorno.
- Se añade interfaz de configuración Web Push, desactivada hasta que se configure `PUSH_API_BASE` y el backend.
- Se añade generador de claves VAPID y plantilla de entorno sin secretos.
- Se actualiza la versión y el nombre de caché del service worker para favorecer la actualización de la PWA.
- La interfaz muestra por separado los intervalos de USGS e IGC-UP.
- Se reduce la consulta experimental de grupos de movimiento a un intervalo mínimo de 15 s en lugar de consultar cada 5 s; no afecta al intervalo del catálogo sísmico.
- Se mantiene desactivada la detección comunitaria por acelerómetro y la licencia MIT existente.
- Se añade CI para comprobaciones de sintaxis y pruebas automáticas.

## v0.6.0

- Mejora inicial de PWA, configuración de consultas, proxy IGC-UP con orígenes explícitos, privacidad inicial y documentación de publicación.
- Notificaciones push no configuradas.

## Nota de versiones

La versión 0.7.0 añade un backend de referencia, pero su inclusión en el ZIP no significa que esté desplegado, configurado ni probado en infraestructura pública. No anunciar notificaciones remotas como activas hasta completar configuración y pruebas en dispositivos reales.
