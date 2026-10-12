# Continuidad y recuperación

Este documento es un plan mínimo para un piloto comunitario; no equivale a un plan certificado de continuidad para emergencias.

## Fallo de una fuente

- Mostrar el estado de la fuente y la antigüedad del último dato correcto.
- No reportar que la vigilancia está activa si todas las fuentes consultadas fallaron.
- Conservar enlace a las fuentes oficiales para consulta manual.

## Fallo del backend push

- La página puede seguir mostrando los datos mientras la web y sus fuentes funcionen, pero no recibirá nuevos push si el backend está caído.
- Configura comprobaciones periódicas de `/healthz`, alertas de hosting y registro de errores.
- Reinicia el servicio después de corregir el problema y confirma que el monitor y la base de datos arrancan.

## Copias de seguridad

- Respalda la base SQLite según la plataforma y sin hacer público el archivo. Las suscripciones contienen endpoints y claves de autenticación Web Push.
- Guarda la clave privada VAPID en un gestor de secretos o almacenamiento seguro. No la incluyas en backups de acceso público.
- Prueba la restauración de una copia; no asumas que una copia existe hasta verificarla.

## Incidente de seguridad

1. Desactiva temporalmente el monitor o la API afectada.
2. Revoca/rota secretos expuestos y evalúa si la clave VAPID debe rotarse (la rotación requerirá renovar suscripciones).
3. Conserva registros mínimos útiles, sin distribuir tokens/ubicaciones.
4. Corrige, prueba y despliega una versión revisada.
5. Comunica de forma clara qué ocurrió y qué deben hacer usuarios/administradores, sin exagerar ni ocultar impacto.

## Escalamiento nacional

Antes de una adopción crítica hacen falta redundancia, monitorización 24/7, acuerdos con proveedores, plan de incidentes probado, objetivos de disponibilidad y revisión independiente de seguridad y sismología. Esta versión no ofrece esas garantías.
