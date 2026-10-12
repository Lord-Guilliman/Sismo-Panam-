# Sismo Panamá v0.7.1

**PWA comunitaria de código abierto para consultar reportes sísmicos de Panamá y alrededores.**

> **Aviso esencial:** Sismo Panamá es un proyecto independiente y no oficial. No predice terremotos, no es un sistema de alerta temprana y no sustituye las indicaciones de SINAPROC ni de otras autoridades. Las fuentes pueden publicar datos segundos o minutos después del movimiento y revisar los primeros valores.

## Qué contiene esta versión

- PWA instalable para navegadores compatibles, con mapa, lista, filtros, fuentes USGS e IGC-UP y almacenamiento local de preferencias.
- Intervalos visibles y configurables: USGS cada 30 s en primer plano / 15 s en modo vigilia; IGC-UP cada 60 s / 30 s en modo vigilia. La pestaña oculta baja USGS a 120 s e IGC-UP a 180 s. El navegador o el sistema operativo pueden suspender la ejecución.
- Service worker versionado y soporte de recepción Web Push **solo cuando se configura y despliega el backend opcional**.
- Backend Web Push de referencia en `backend/`: gestión de suscripciones, límites básicos, almacenamiento SQLite y vigilante de USGS activable por configuración.
- Política de privacidad, política de alertas, arquitectura, fuentes, recuperación, contribución y controles básicos de calidad.
- Detección comunitaria por acelerómetro desactivada.

## Descargar / instalar la PWA

1. Despliega los archivos web mediante GitHub Pages desde la rama `main` y la carpeta raíz.
2. Comparte la URL de GitHub Pages, por ejemplo `https://TU_USUARIO.github.io/sismo-panama/`. Ese es el enlace para abrir e instalar la aplicación.
3. El repositorio `https://github.com/TU_USUARIO/sismo-panama` sirve para revisar o descargar el código; no es el enlace de instalación.
4. Android/Chrome: menú del navegador → **Instalar aplicación** o **Añadir a pantalla de inicio**. iPhone/iPad: Safari → Compartir → **Añadir a pantalla de inicio**.

Pasos completos: [PUBLICAR.md](PUBLICAR.md). Antes de un lanzamiento, sigue también [PRE_RELEASE_CHECKLIST.md](PRE_RELEASE_CHECKLIST.md).

## Desarrollo local (Windows)

1. Extrae el ZIP completo.
2. Ejecuta `iniciar_sismo_panama.bat`.
3. Abre `http://localhost:8000/`.
4. Pruebas web: `http://localhost:8000/tests/pruebas.html`.
5. Pruebas Python: `python tests/test_python.py`.
6. Comprobación de sintaxis: `node --check app.js` y `node --check push-client.js` (si Node.js está instalado).

No abras directamente `index.html` con `file://`; los service workers y ciertas APIs requieren HTTPS o localhost.

## Arquitectura

- **Frontend estático:** `index.html`, `styles.css`, `app.js`, `core.js`, `config.js`, `push-client.js`, `sw.js`, `manifest.webmanifest`.
- **Servidor local de desarrollo:** `server.py`; no es el backend de producción y no debe exponerse a Internet sin rediseño y endurecimiento.
- **Proxy opcional IGC-UP:** `cloudflare_worker.js`; solo proxy de lectura. Restringe `ALLOWED_ORIGINS` antes del despliegue.
- **Backend Web Push opcional:** `backend/`; se despliega por separado. El vigilante actual usa el catálogo USGS dentro de la región configurada. No se encuentra habilitado por defecto.

Consulta [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [docs/ALERT_POLICY.md](docs/ALERT_POLICY.md).

## Estado de las notificaciones

**No se activan automáticamente al publicar la PWA.** Para recibirlas con la app cerrada hace falta desplegar `backend/`, configurar claves VAPID como secretos del entorno, usar almacenamiento persistente, establecer `ALLOWED_ORIGINS`, configurar `PUSH_API_BASE` en `config.js` y verificar todo en dispositivos reales. GitHub Pages por sí solo no ejecuta el servicio de envío.

La v0.7.1 incluye una implementación de referencia que puede desplegarse tras revisar sus límites operativos. No debe considerarse un servicio de alerta crítica o de disponibilidad garantizada.

## Colaboración y seguridad

- Contribuciones: [CONTRIBUTING.md](CONTRIBUTING.md).
- Código de conducta: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- Reporte de vulnerabilidades: [SECURITY.md](SECURITY.md); no publiques detalles explotables en issues públicos.
- Gobierno y toma de decisiones: [GOVERNANCE.md](GOVERNANCE.md).
- Licencia: [LICENSE](LICENSE) (MIT conservada de la versión recibida).
- Aviso de limitaciones: [DISCLAIMER.md](DISCLAIMER.md); condiciones básicas: [TERMS_OF_USE.md](TERMS_OF_USE.md).
- Ajustes del propietario que no se pueden versionar en el ZIP: [docs/GITHUB_HARDENING.md](docs/GITHUB_HARDENING.md).
- Terceros y recursos: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Historial: [CHANGELOG.md](CHANGELOG.md).

## Alcance institucional

Sismo Panamá es independiente y no está respaldada ni operada por el Gobierno de Panamá, SINAPROC, USGS ni la Universidad de Panamá. Una eventual adopción institucional requeriría evaluación técnica, acuerdos, pruebas, operación y responsabilidades definidas; no se afirma que exista una aprobación.

## Antes de probar o publicar

- Guía paso a paso para el teléfono: [PRUEBA_EN_TELEFONO.md](PRUEBA_EN_TELEFONO.md).
- Qué publicar y qué no publicar: [QUE_PUBLICAR_Y_QUE_NO.md](QUE_PUBLICAR_Y_QUE_NO.md).
- Privacidad del mantenedor: [docs/PRIVACIDAD_DEL_MANTENEDOR.md](docs/PRIVACIDAD_DEL_MANTENEDOR.md).
- Ruta realista hacia una posible alerta temprana: [docs/RUTA_ALERTA_TEMPRANA.md](docs/RUTA_ALERTA_TEMPRANA.md).

La compilación de prueba v0.7.1 usa el tono de alarma sintetizado; se excluyó el audio personalizado hasta verificar los derechos de redistribución.
