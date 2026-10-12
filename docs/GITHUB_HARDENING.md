# Configuración manual de seguridad del repositorio

Estas acciones se configuran en la cuenta/repositorio y no pueden activarse mediante los archivos del ZIP.

## Repositorio

- Mantén el repositorio público si quieres que el proyecto sea abierto; no añadas secretos aunque el repositorio sea público.
- Revisa **Settings → Collaborators** antes de dar permisos de escritura.
- En **Settings → Branches** crea una regla para `main`: cambios mediante pull request, exigir que pase el workflow de validación y evitar force-push/eliminación de la rama.
- En **Settings → Code security and analysis**, activa las funciones disponibles para Dependabot alerts, security updates, secret scanning y push protection.
- Revisa las alertas de dependencias que genere Dependabot antes de combinar cambios.
- Mantén Actions con permisos mínimos (`contents: read` para validación) y revisa los logs para evitar secretos.

## Antes de abrir contribuciones externas

- Revisa `SECURITY.md` y habilita el reporte privado de vulnerabilidades en **Security → Advisories** si la función está disponible.
- Mantén el flujo CI obligatorio para cambios que afecten producción. El workflow CI puede necesitar permiso de escritura/administración del repositorio para marcarse como chequeo obligatorio; no le des más permisos de los necesarios.
- No guardes credenciales de despliegue en variables públicas. Usa secrets de entorno/repository para un backend, limitados al entorno correspondiente.
- Limita quién puede editar la configuración de Pages, el backend y el DNS.

## Backend

CORS no es una barrera de autenticación. Combina orígenes estrictos con rate limits/WAF del proveedor, límites de cuerpo, monitorización, secretos privados, logs sin endpoints/token y almacenamiento persistente. El código de referencia incluye protecciones básicas, no una auditoría de seguridad ni un escudo contra abuso distribuido.
