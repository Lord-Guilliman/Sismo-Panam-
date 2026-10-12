> **Privacidad y revisión previa:** Antes de subir archivos, sigue [QUE_PUBLICAR_Y_QUE_NO.md](QUE_PUBLICAR_Y_QUE_NO.md) y configura el seudónimo/email de commits según [docs/PRIVACIDAD_DEL_MANTENEDOR.md](docs/PRIVACIDAD_DEL_MANTENEDOR.md). La guía paso a paso para instalar la PWA en tu teléfono está en [PRUEBA_EN_TELEFONO.md](PRUEBA_EN_TELEFONO.md).

# Publicar Sismo Panamá v0.7.1

Esta guía distingue **la web instalable** del **servicio de notificaciones remoto**. Son dos despliegues separados.

## A. Probar la versión descargada

1. Extrae el ZIP completo a una carpeta nueva.
2. Ejecuta `iniciar_sismo_panama.bat` y abre `http://localhost:8000/`.
3. Confirma que el encabezado indique **v0.7.1** y que el estado muestre `USGS 30 s · IGC-UP 60 s` mientras la pestaña está visible.
4. Abre `http://localhost:8000/tests/pruebas.html` y pulsa ejecutar pruebas.
5. En otra ventana ejecuta `python tests/test_python.py`.
6. Si Node.js está instalado, ejecuta `node --check app.js`, `node --check core.js` y `node --check push-client.js` y `node --input-type=module --check < cloudflare_worker.js`.

El tiempo mostrado es el intervalo de consulta planificado del catálogo, no una garantía de cuándo la fuente publica el evento ni de cuándo llega una alerta. En modo vigilia la UI muestra USGS 15 s e IGC-UP 30 s. Con la pestaña oculta, la frecuencia baja. Los navegadores pueden suspender tareas.

### Si aún ves 5 s en vez de v0.7.1

- Comprueba el texto de versión en el encabezado/footer; si ves v0.6 o v0.5 no estás viendo los archivos nuevos.
- Si es GitHub Pages, confirma que el commit `v0.7.1` ya se subió y que el despliegue de **Actions / Pages** terminó correctamente.
- En escritorio, haz recarga forzada con `Ctrl+F5`. En Chrome abre DevTools → **Application** → **Service Workers** → `Unregister`, y **Storage** → `Clear site data`; cierra y vuelve a abrir la pestaña instalada.
- En Android, fuerza el cierre de la PWA y vuelve a abrirla. Si sigue mostrando versión antigua, quita temporalmente la instalación y abre el enlace de Pages en Chrome. No des por hecho que la actualización está instalada hasta ver v0.7.1.
- El sondeo experimental de grupos de movimiento, si se habilitara explícitamente, ahora tiene un mínimo de 15 s; no consulta el catálogo sísmico cada 5 s.

## B. Publicar la PWA gratis en GitHub Pages

1. Crea un repositorio **público** llamado `sismo-panama` (u otro nombre que prefieras).
2. Sube **el contenido de esta carpeta** al nivel raíz del repositorio. Debes ver `index.html`, `app.js`, `push-client.js`, `core.js`, `config.js`, `sw.js`, `manifest.webmanifest`, `icons/`, `tests/` y la documentación directamente en la raíz, sin una carpeta extra `SismoPanama_v071` dentro del repositorio.
3. En el repositorio abre **Settings → Pages**.
4. Elige **Deploy from a branch**, rama `main`, carpeta `/(root)` y guarda. Espera a que termine el despliegue.
5. La URL será normalmente `https://TU_USUARIO.github.io/sismo-panama/`.

**El enlace que compartes con las personas es la URL de GitHub Pages.** La URL `https://github.com/TU_USUARIO/sismo-panama` permite ver/descargar el código fuente; no instala la PWA por sí sola. GitHub Pages tampoco genera una APK Android.

### Instalar

- **Android:** abre el enlace en Chrome; menú `⋮` → **Instalar aplicación** o **Añadir a pantalla de inicio**.
- **iPhone/iPad:** abre el enlace en Safari → Compartir → **Añadir a pantalla de inicio**.
- El permiso de notificaciones se solicita aparte; instalar no concede permiso automáticamente.

## C. Proxy opcional para IGC-UP

GitHub Pages no tiene la ruta local `/api/igc`. Si IGC-UP bloquea el acceso directo por CORS:

1. Despliega `cloudflare_worker.js` como Cloudflare Worker.
2. Edita `ALLOWED_ORIGINS` con el origen exacto de Pages (por ejemplo `https://TU_USUARIO.github.io`); no incluyas `/sismo-panama/`. El archivo ya no incluye localhost por defecto; añádelo solo temporalmente para pruebas locales y quítalo antes de dejar el Worker público.
3. Despliega el Worker y copia su URL HTTPS.
4. En `config.js`, asigna `IGC_PROXY: 'https://TU-WORKER.workers.dev/'`.
5. Publica el cambio. Prueba el proxy y respeta los términos y límites de la web fuente.

Este Worker solo recupera información pública de IGC-UP. No envía push. Rechaza solicitudes sin `Origin`, pero el encabezado se puede falsificar: CORS no equivale a autenticación y el servicio debe tener límites de uso/monitorización configurados en Cloudflare.

## D. Activar notificaciones con la app cerrada (requiere backend separado)

**No actives esta función directamente al publicar Pages.** La interfaz mantiene el botón desactivado mientras `PUSH_API_BASE` está vacío. La PWA puede seguir mostrando el mapa y avisos locales.

1. Lee `backend/README.md`, `SECURITY.md`, `PRIVACY.md` y `docs/ALERT_POLICY.md`.
2. Despliega `backend/` en un proveedor que ejecute Python, ofrezca HTTPS y almacenamiento persistente.
3. Instala `backend/requirements.txt` y genera las claves VAPID con `python backend/generate_vapid.py --output /ruta/privada/vapid_private.pem`. Guarda el archivo privado fuera del repositorio. La herramienta imprime la clave pública.
4. Configura en el hosting del backend `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY_PATH`, `VAPID_SUBJECT`, `ALLOWED_ORIGINS`, `PUBLIC_APP_URL`, `SISMO_DB_PATH`, `ENABLE_MONITOR=false` y `POLL_SECONDS=30`. Usa valores reales y privados donde corresponda. No copies claves reales a `.env.example` ni a GitHub.
5. Comprueba `/healthz`. Prueba crear y cancelar la suscripción con un dispositivo de prueba. Aplica rate limiting/WAF del proveedor: el limitador local es solo básico.
6. Configura `PUSH_API_BASE` en `config.js` con la URL HTTPS del backend (sin barra final) y vuelve a publicar Pages. Esto hace visible el botón de suscripción.
7. Con `ENABLE_MONITOR=false`, valida permisos, suscripción y cancelación. Cuando el sistema esté revisado, activa `ENABLE_MONITOR=true` y confirma en logs que el monitor consulta USGS.
8. Prueba notificaciones en varios dispositivos, con pantalla bloqueada, ahorro de batería, permisos denegados, pérdida de red, reinstalación y recuperación del backend. Comprueba umbral, deduplicación y actualización de magnitud.
9. Publica la política de privacidad real del operador, incluyendo cómo contactar con el responsable, retención y proveedor de alojamiento.

El backend incluido es una **implementación de referencia para un piloto**, no un servicio certificado ni de alta disponibilidad. Su monitor v0.7.1 consulta USGS y no envía los eventos IGC-UP. Las notificaciones pueden retrasarse o no llegar. No se deben anunciar como un sistema de alerta oficial o garantizado.

## E. Seguridad mínima para un repositorio público

- Mantén MIT si tras revisar los recursos es la licencia que deseas; la licencia incluida se ha conservado de la versión recibida. Consulta `LICENSE_ASSETS.md` y `THIRD_PARTY_NOTICES.md`.
- Lee `SECURITY.md` y aplica los ajustes manuales de `docs/GITHUB_HARDENING.md`; habilita informes privados de vulnerabilidades cuando GitHub lo permita y no informes vulnerabilidades explotables en una issue pública.
- Activa Dependabot y secret scanning/push protection si están disponibles en Settings → Code security and analysis. Los flujos CI no reemplazan estos ajustes de cuenta/repositorio.
- Protege `main`, requiere pull requests/revisión para cambios de alertas y espera a que pasen las pruebas de Actions.
- Nunca subas claves privadas, `.env`, bases de datos de suscripciones, tokens push o sonidos/recursos sin permiso.
- No expongas `server.py` a Internet; es un servidor local de desarrollo.
- No actives `ENABLE_COMMUNITY`; el acelerómetro sigue desactivado.

## F. Google Play en una etapa futura

La PWA, una APK y un Android App Bundle son canales distintos. Para Play Store habrá que adaptar la app (por ejemplo, con Capacitor), probar integración Android, firmar el AAB, preparar ficha, privacidad y declaración de seguridad/datos, y cumplir el requisito vigente de API objetivo al momento de enviar. No se genera APK al publicar en GitHub Pages.
