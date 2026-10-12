# Lista de verificación antes de publicar Sismo Panamá

Esta lista distingue una PWA de consulta, un piloto con Web Push y una eventual operación institucional. Marcar elementos en este documento no sustituye la prueba real.

## 1. Antes de hacer público el repositorio

- [ ] Confirmar quién mantiene el proyecto y añadir un canal de contacto de seguridad en `SECURITY.md` y `privacidad.html`.
- [ ] Confirmar que la licencia MIT sigue siendo la elegida y que quien publica tiene derecho a licenciar todo el código propio.
- [ ] Verificar los derechos y atribuciones de iconos, logotipo y `sounds/alerta_libre.mp3`; retirar todo recurso con procedencia incierta. En v0.7.1 el audio personalizado ya está excluido; quedan por verificar los derechos de los iconos/logotipo.
- [ ] Revisar los archivos a publicar en busca de tokens, claves, datos personales, bases SQLite y `.env` real. Usa `QUE_PUBLICAR_Y_QUE_NO.md`.
- [ ] Revisar `PRUEBA_EN_TELEFONO.md` y `docs/PRIVACIDAD_DEL_MANTENEDOR.md` antes de subir el repositorio.
- [ ] Hacer una revisión de todos los enlaces, fuentes y avisos de terceros.
- [ ] Configurar protección de la rama `main`, revisión mediante pull request, Dependabot y análisis de secretos cuando estén disponibles.
- [ ] Confirmar que el workflow de CI termine correctamente en GitHub Actions.

## 2. Antes de compartir una PWA de prueba

- [ ] Publicar los archivos del proyecto directamente en la raíz de GitHub Pages, incluidos los recursos ocultos necesarios como `.nojekyll`; no anidar otra carpeta de proyecto.
- [ ] Confirmar que la dirección usa HTTPS y comparte la URL de Pages, no solo el repositorio.
- [ ] Probar el mapa, fuentes, filtros, sonido, notificaciones locales, permisos y modo sin conexión en Chrome Android, Safari iOS y escritorio compatible.
- [ ] Verificar la versión visible `v0.7.1` y el texto de intervalos: primer plano USGS 30 s/IGC-UP 60 s; vigilia USGS 15 s/IGC-UP 30 s; pestaña oculta USGS 120 s/IGC-UP 180 s. Los navegadores pueden retrasar/suspender temporizadores en segundo plano.
- [ ] Comprobar qué ocurre si una fuente no responde, si su respuesta está desactualizada o si el dispositivo pierde conexión.
- [ ] Mantener `PUSH_API_BASE` vacío si no existe backend desplegado. No anunciar Web Push remoto hasta completar pruebas reales.

## 3. Antes de probar Web Push en un piloto

- [ ] Desplegar backend y base de datos en un proveedor con HTTPS y almacenamiento persistente; nunca usar GitHub Pages para ejecutar backend.
- [ ] Instalar dependencias desde `backend/requirements.txt` en un entorno con conexión, generar las claves VAPID y proteger la clave privada fuera del repositorio.
- [ ] Configurar `ALLOWED_ORIGINS`, `PUBLIC_APP_URL`, `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY_PATH` y `SISMO_DB_PATH` reales; no dejar marcadores `TU_USUARIO` o `TU_CORREO_REAL`.
- [ ] Aplicar rate limiting/WAF y límites de petición en el proveedor; los límites en memoria son solo una defensa básica.
- [ ] Ejecutar primero con `ENABLE_MONITOR=false`; validar suscripción/cancelación y `healthz`.
- [ ] Habilitar el monitor solo con un proceso/instancia única y cuando el responsable acepte el comportamiento; validar logs, umbrales, duplicados y revisiones de magnitud.
- [ ] Probar push real en varios dispositivos y navegadores, también con pantalla bloqueada, ahorro de batería, permisos denegados, pérdida de red, reinstalación y recuperación.
- [ ] Medir latencia de fuente, consulta, backend, proveedor push y recepción; documentar que no hay garantía de entrega ni aviso previo al movimiento.
- [ ] Actualizar la política de privacidad con el contacto real, proveedores, retención, logs y prácticas del hosting.

## 4. Antes de una operación amplia o institucional

- [ ] Auditoría de seguridad independiente y revisión de amenazas/privacidad.
- [ ] Revisión por especialistas de sismología de fuentes, criterios, lenguaje de alertas y tratamiento de revisiones.
- [ ] Pruebas de carga, resiliencia, alta disponibilidad, recuperación, rotación de secretos y respuesta a incidentes.
- [ ] Diseñar cola de trabajo y coordinación antes de escalar a múltiples instancias.
- [ ] Definir responsables, mantenimiento, financiación, soporte, objetivos de servicio, comunicación pública y límites de responsabilidad.
- [ ] Obtener acuerdos y validaciones oficiales si se pretende una integración con entidades públicas.

**Estado al empaquetar v0.7.1:** la PWA y el backend de referencia están en el ZIP; las pruebas automatizadas locales se ejecutan. El backend no está desplegado ni configurado con credenciales reales, el envío push real no se ha probado y no hay auditoría independiente. La versión puede evaluarse como prototipo, no como sistema de alerta de emergencia garantizado.
