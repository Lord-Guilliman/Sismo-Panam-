# Despliegue

## Sitio estático

La web se despliega en GitHub Pages desde la rama `main`, carpeta `/(root)`. Comparte la URL HTTPS de Pages, no la URL del repositorio. La PWA puede instalarse desde navegadores compatibles; no se genera una APK con GitHub Pages.

## Proxy opcional IGC-UP

Despliega `cloudflare_worker.js` como Worker separado y configura el origen exacto de Pages en `ALLOWED_ORIGINS`. CORS no es autenticación, por lo que el proxy debe tener límites de abuso y observar las condiciones del sitio fuente. No uses `*`. El Worker rechaza peticiones sin `Origin` para limitar el uso casual, pero un cliente HTTP puede falsificar ese encabezado: configura también rate limiting en Cloudflare y no consideres CORS como autenticación.

## Backend Web Push

Sigue `../backend/README.md`. Despliega el backend en un hosting de aplicaciones compatible con Python y HTTPS; usa un volumen persistente para SQLite. Mantén el backend fuera de GitHub Pages. No habilites `ENABLE_MONITOR=true` hasta instalar claves VAPID, revisar el dominio de la app, configurar `ALLOWED_ORIGINS`, aplicar rate limiting de borde y completar pruebas.

## Reversión

1. Desactiva `ENABLE_MONITOR` en el hosting del backend o revierte el despliegue.
2. Si hay un problema frontend, repone el release anterior y confirma que `CACHE_NAME` cambia entre versiones.
3. No borres la base de datos de suscripciones durante una reversión sin evaluar el impacto: eliminarla obliga a los usuarios a volver a suscribirse.
