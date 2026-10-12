# Notificador ntfy personal (herramienta separada)

El archivo `notificador_ntfy.py` es una herramienta heredada para un operador que quiera enviar avisos a una suscripción/topic de ntfy. **No forma parte del flujo Web Push de la PWA y no es el backend que usa `push-client.js`.**

- No ejecutes esta herramienta como sistema oficial o de alta disponibilidad sin rediseño y revisión.
- Si usas un servidor público de ntfy, trata el nombre del topic como un secreto con alta entropía; cualquiera que lo adivine puede leer o publicar en ese topic según el servidor y su configuración.
- No guardes el topic en el repositorio, capturas públicas, issues ni mensajes de log.
- Revisa el proveedor y su política antes de mandar eventos o metadatos.
- Prueba primero con `--prueba` o `--solo-prueba-sin-enviar`; para usarla requiere mantener un proceso ejecutándose y conexión de red.

Para avisos de la PWA cuando está cerrada, consulta `backend/README.md`.
