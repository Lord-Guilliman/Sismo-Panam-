# Gobernanza del proyecto

## Propósito

Sismo Panamá es un proyecto comunitario de código abierto para facilitar la consulta de reportes sísmicos públicos. No es un sistema oficial de alerta temprana y no sustituye a las autoridades.

## Mantenedores y cambios

Durante la fase inicial, el propietario del repositorio mantiene la responsabilidad de revisar y aceptar cambios. Una contribución no se incorpora automáticamente por ser pública. Los cambios que afectan fuentes, umbrales, mensajes de alerta, suscripciones, privacidad o backend requieren especial atención y pruebas.

## Decisiones técnicas

- Los cambios pequeños pueden aprobarse mediante pull request después de pasar las pruebas.
- Los cambios de arquitectura deben documentar alternativas, riesgos y plan de reversión.
- Las modificaciones de política de alertas deben reflejarse en `docs/ALERT_POLICY.md` y `CHANGELOG.md`.
- Las decisiones que afecten a la privacidad deben actualizar `PRIVACY.md` y `privacidad.html` antes del despliegue.

## Posibles usos institucionales

El software MIT permite reutilización según esa licencia, pero el repositorio no otorga aprobación oficial, soporte, certificación ni derecho a utilizar marcas de terceros. Una colaboración o adopción institucional requiere acuerdos aparte y evaluación de las partes. No se presentará una instalación de terceros como oficial sin autorización verificable.

## Marca, datos y financiación

La licencia del código no concede necesariamente derechos sobre marcas, logotipos, bases de datos externas ni recursos de terceros. Los acuerdos de financiación, soporte o marca deben documentarse por separado y no pueden contradecir los avisos de seguridad pública del proyecto.
