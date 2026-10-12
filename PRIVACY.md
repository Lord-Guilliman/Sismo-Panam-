# Privacidad de Sismo Panamá

La política publicada para usuarios está en [`privacidad.html`](privacidad.html). Este resumen técnico no la sustituye.

- **PWA sin Push configurado:** no pide cuenta ni correo. Las preferencias se quedan en almacenamiento local. La ubicación solo se solicita si el usuario pulsa “Mi ubicación” y se utiliza en el dispositivo.
- **Push opcional:** al activar el backend, se almacenan la URL de suscripción de navegador, las claves de esa suscripción, el umbral de magnitud y marcas temporales. No se recoge la ubicación precisa en el flujo push actual.
- **Retención prevista del backend de referencia:** suscripciones hasta cancelación/expiración o 12 meses sin actualizar; historial de envíos hasta 90 días. La API usa la IP en memoria de forma temporal para aplicar rate limiting, no la guarda en SQLite. Los registros del proveedor de alojamiento pueden tener reglas propias.
- **Terceros:** USGS, IGC-UP, CDN Leaflet, OpenStreetMap, alojamiento web y, si se configura, proveedor de backend y servicio push.
- **Antes de activar producción:** el operador debe completar un contacto real en `privacidad.html`, verificar que la política corresponde a la configuración real y actualizarla si cambian los datos o proveedores.

No almacenar secretos ni datos personales en el repositorio público. El endpoint de Web Push y su token son datos sensibles de operación.
