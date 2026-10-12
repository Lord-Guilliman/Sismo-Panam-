# Backend Web Push (opcional)

Este servicio está separado de GitHub Pages. Administra suscripciones Web Push y contiene un vigilante básico de eventos recientes de USGS para Panamá y alrededores.

> **No es un sistema oficial de alerta temprana.** El monitor no predice terremotos, no llama a SINAPROC y no incluye reportes IGC-UP en push en esta versión. Antes de abrirlo al público, revisa `../SECURITY.md`, `../docs/ALERT_POLICY.md` y `../docs/DISASTER_RECOVERY.md`.

## Qué hace

- `GET /healthz`: estado básico del proceso.
- `GET /api/push/public-key`: entrega la clave pública VAPID para que el navegador cree la suscripción.
- `POST /api/push/subscribe`: registra un endpoint de push y una magnitud mínima permitida.
- `DELETE /api/push/subscribe`: elimina una suscripción.
- Vigilante de USGS opcional cuando `ENABLE_MONITOR=true`.
- SQLite para suscripciones y estado de notificaciones enviadas.

No existe endpoint público para enviar mensajes arbitrarios. Los envíos los genera el monitor a partir de los datos procesados. Los endpoints de suscripción se limitan a dominios conocidos de proveedores Web Push (FCM/Google, Apple y Mozilla) para evitar usar el servidor como proxy de solicitudes a destinos HTTPS arbitrarios; si se añade otro navegador/proveedor, documenta y revisa su dominio antes de ampliarlo.

## Instalación local

Requiere Python 3.10 o posterior.

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python backend/generate_vapid.py --output "RUTA_PRIVADA/vapid_private.pem"
```

Copia las variables de `backend/.env.example` en la configuración segura del proceso. No subas un `.env` con valores reales. `VAPID_PRIVATE_KEY_PATH` apunta al archivo privado generado, mientras que `VAPID_PUBLIC_KEY` es el valor que imprimió la herramienta.

Arranca solo la API en una terminal con variables cargadas:

```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8787
```

En un proveedor público, utiliza la dirección/puerto que exige su plataforma (habitualmente `0.0.0.0` y la variable `PORT`). Si `ENABLE_MONITOR=true`, ejecuta **un solo proceso/instancia monitor**; varios workers o réplicas podrían enviar duplicados. Para crecer, separa el monitor como trabajador único con coordinación/cola antes de añadir réplicas API.

`ENABLE_MONITOR=false` por defecto. No uses claves reales en una máquina compartida. Para probar integración local desde la PWA usa un túnel HTTPS únicamente si entiendes la exposición que implica y añade su origen exacto a `ALLOWED_ORIGINS`.

## Despliegue de piloto

1. Usa un proveedor que ejecute procesos Python y HTTPS.
2. Configura `ALLOWED_ORIGINS` con el origen exacto de Pages, por ejemplo `https://tuusuario.github.io` (sin `/sismo-panama/`).
3. Configura `PUBLIC_APP_URL` con la URL exacta de la PWA.
4. Guarda `VAPID_PRIVATE_KEY_PATH` en un secreto/volumen privado; configura `VAPID_PUBLIC_KEY` como variable de entorno.
5. Configura un volumen persistente para `SISMO_DB_PATH`. Si el sistema de archivos es efímero, se perderán las suscripciones al reiniciar.
6. Aplica rate limiting/WAF en el borde. Los límites en memoria de esta referencia no son suficientes para resistir abuso distribuido.
7. Ejecuta primero con `ENABLE_MONITOR=false`, prueba registro y cancelación, comprueba salud y logs.
8. Tras validar la fuente, claves y tiempos, habilita `ENABLE_MONITOR=true` y `POLL_SECONDS=30` o superior.
9. Establece `PUSH_API_BASE` en el `config.js` del sitio estático a la URL HTTPS del backend sin una barra final, luego publica esa versión.
10. Verifica un push real en al menos dos dispositivos, con pantalla bloqueada, permisos concedidos/denegados, conexión perdida y recuperación. No declares el sistema fiable solo porque `/healthz` responda.

## Límites conocidos

- El monitor solo usa el catálogo USGS, no IGC-UP.
- SQLite es apropiado para un piloto de una instancia; para alta disponibilidad/múltiples réplicas necesitará otra persistencia o diseño.
- El límite por defecto es 1.000 suscripciones por piloto; los envíos usan un pool acotado de 12 trabajadores. El limitador en memoria se reinicia al reiniciar y no coordina varias instancias. Debe complementarse con protección en el proveedor.
- No recopila ubicación para las preferencias push de esta versión; se usa un umbral de magnitud para la región configurada.
- Push puede retrasarse o no llegar debido al proveedor, permisos, red, ahorro de batería o plataforma.
- La respuesta CORS no es autenticación; no debe tratarse como la única protección.

## Pruebas

Con dependencias instaladas:

```bash
python -m unittest discover -s backend/tests -v
```

Las pruebas no consultan el USGS ni mandan mensajes reales.
