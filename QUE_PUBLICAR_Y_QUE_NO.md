# Qué publicar y qué no publicar en GitHub

Esta lista está pensada para que el repositorio sea público y de código abierto sin convertir por accidente el repositorio en un archivo de datos privados.

## Publicable después de revisar licencias

- Código de la PWA: `index.html`, `styles.css`, `app.js`, `core.js`, `config.js`, `sw.js`, `push-client.js` y `manifest.webmanifest`.
- Código fuente de los servicios opcionales: `backend/`, `cloudflare_worker.js`, `server.py` y `notificador_ntfy.py`. Publicar el código no significa que debas desplegar esos servicios ahora.
- Tests, ejemplos de configuración sin secretos (`backend/.env.example`), documentación, archivos de GitHub Actions, `LICENSE`, `.gitignore` y guías de seguridad.
- Los iconos y logotipos solamente después de confirmar que tú tienes derecho a redistribuirlos. MIT no concede derechos sobre recursos de terceros que no sean tuyos.

## No publiques nunca en un repositorio público

- `.env` con valores reales, claves VAPID privadas (`*.pem`), tokens, contraseñas, claves API, GitHub Personal Access Tokens o credenciales de hosting.
- La base de datos en ejecución (`*.sqlite3`, `*.db`), suscripciones Web Push, endpoints push, claves de suscripción, copias de seguridad reales o volcados de base de datos.
- El tema secreto de ntfy, links privados de administración, logs que puedan contener endpoints/tokens, capturas de dashboards del hosting o datos de suscriptores.
- Cookies exportadas del navegador (`cookies.txt`), archivos `.har` con cabeceras/cookies, contraseñas, datos de cuenta o archivos de recuperación de 2FA.
- Nombre legal, correo personal, teléfono, dirección, documentos, ubicación de casa o capturas que muestren notificaciones privadas, Wi-Fi, matrículas o información del dispositivo.
- `*.sqlite*`, `*.db`, `*.pem`, `.env`, `.venv/`, `__pycache__/`, archivos de log y carpetas de editor/locales. `.gitignore` actualizado ayuda con Git, pero no evita que selecciones y subas manualmente un archivo en la web.

## Estado del ZIP SismoPanama v0.7.1

- El ZIP no contiene carpeta `.git` ni historial de commits.
- En el escaneo de esta copia no encontré una dirección de correo personal, una clave privada, un `.env` real, una base de datos SQLite ni rutas locales como `C:\Users\...`.
- Se excluyeron `.vscode/`, `SismoPanama.code-workspace` y el audio personalizado. El tono sintetizado de `app.js` sigue disponible.
- Los archivos `backend/.env.example` son plantillas con marcadores, no credenciales reales.
- No pude verificar la titularidad de los iconos/logotipos solo mirando el ZIP: confírmala antes de redistribuirlos.

Este escaneo no garantiza que todo el contenido sea legalmente redistribuible ni revisa cuentas, historial Git que tengas en otro lugar, la configuración de tu proveedor o datos que añadas después.

## Antes de cada commit

En la carpeta del proyecto abre PowerShell y ejecuta:

```powershell
git status --short
git status --ignored --short
```

Tras preparar los cambios, revisa exactamente lo que va a entrar en el commit:

```powershell
git add .
git status --short
git diff --cached --stat
```

Si ves un secreto o archivo que no debe publicarse, no hagas commit ni push. Quitar un secreto en un commit posterior no borra el secreto del historial público: hay que revocarlo/rotarlo y limpiar el historial siguiendo un procedimiento específico.

## Recordatorio

El código puede ser abierto sin que publiques datos operativos. Es correcto publicar `backend/main.py`; no publiques `backend/data/sismo_push.sqlite3` ni `VAPID_PRIVATE_KEY_PATH` real. Es correcto publicar `backend/.env.example`; no publiques `.env` con valores de producción.
