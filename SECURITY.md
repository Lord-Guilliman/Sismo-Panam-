# Política de seguridad

## Alcance

Esta política cubre el código de Sismo Panamá y sus componentes mantenidos en este repositorio. No convierte el proyecto en un sistema oficial ni garantiza disponibilidad para emergencias.

## Reportar una vulnerabilidad

**No publiques una vulnerabilidad explotable en una issue pública.** Usa la función privada **Security → Advisories → Report a vulnerability** del repositorio si está habilitada. Si no está disponible, contacta al mantenedor mediante un canal privado publicado en su perfil de GitHub; no incluyas secretos en issues, pull requests ni capturas públicas.

Incluye, si puedes hacerlo de forma segura: componente y versión afectados, impacto, pasos de reproducción no destructivos, evidencia mínima y una forma de contacto. Evita acceder a datos de otras personas, degradar servicios o probar contra instalaciones de terceros.

## Qué se considera especialmente sensible

- Falsificación o suplantación de avisos de terremotos.
- Exposición de claves privadas, tokens VAPID, credenciales y endpoints de suscripción.
- Inyección de contenido o redirecciones desde payloads push.
- Abuso de la API de suscripción, agotamiento de cuotas o denegación de servicio.
- Fallos que impidan comunicar que las fuentes están desconectadas o desactualizadas.
- Acceso o retención no autorizada de ubicación, IP, tokens o preferencias.

## Versiones y respuesta

La versión de desarrollo es la prioridad inicial. La revisión y corrección se hará según gravedad y capacidad de los mantenedores; no se promete un SLA. Tras una corrección se podrá publicar un aviso de seguridad y una versión actualizada sin divulgar detalles explotables antes de que exista mitigación razonable.

## Reglas para despliegues

- Nunca pongas claves privadas o archivos `.env` en el repositorio ni en GitHub Pages.
- Mantén `ALLOWED_ORIGINS` exacto; CORS no sustituye autenticación, rate limiting o un WAF.
- No expongas `server.py` directamente a Internet. Es un servidor local de desarrollo.
- Usa HTTPS, logs sin tokens ni ubicaciones, almacenamiento persistente con acceso restringido y controles de rate limit del proveedor. El backend incluye una lista de dominios de proveedores Web Push permitidos para reducir el riesgo de SSRF; revisa esa lista al añadir proveedores.
- No habilites el vigilante push en producción hasta completar las pruebas y la revisión del operador.
