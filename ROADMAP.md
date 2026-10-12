# Hoja de ruta

## v0.7.0 — Base de colaboración y backend push de referencia

- [x] Documentación inicial de arquitectura, fuentes, privacidad, alertas, seguridad, contribución y recuperación.
- [x] Cliente opcional Web Push y API de backend de referencia.
- [x] Pruebas automáticas de la base y CI inicial.
- [ ] Configurar un dominio y un hosting real, almacenamiento persistente, VAPID y límites de borde.
- [ ] Pruebas push con varios teléfonos y redes.

## Siguiente piloto

- [ ] Medir retraso de origen frente a tiempo de consulta y hora de entrega push, sin presentar el resultado como garantía.
- [ ] Añadir monitorización del backend y alertas de salud independientes.
- [ ] Revisar los términos actuales de datos, mapas, audio e iconos.
- [ ] Solicitar revisión técnica externa de la lógica de deduplicación y criterios de alerta.
- [ ] Prueba de recuperación y rotación de secretos.

## Antes de una adopción institucional

- [ ] Auditoría de seguridad independiente.
- [ ] Revisión sismológica de reglas, fuentes y mensajes.
- [ ] Objetivos de disponibilidad, redundancia, continuidad, soporte y respuesta a incidentes.
- [ ] Evaluación de privacidad y retención de datos.
- [ ] Pruebas de carga, fallos, abuso y entrega bajo distintas condiciones de red.
- [ ] Acuerdo formal sobre operación, responsabilidades, marca, financiación y mantenimiento.

Los puntos pendientes no deben interpretarse como funciones ya implementadas.


## v0.7.1 — Preparación de prueba en dispositivo

- [x] Guía de prueba móvil y de publicación segura.
- [x] Guía de privacidad del mantenedor y límite de la anonimidad pública.
- [x] Ruta separada hacia investigación de alerta temprana; no se activa detección comunitaria.
- [x] Audio de procedencia no verificada excluido del paquete de prueba.

La versión actual sigue siendo una PWA informativa basada en catálogos publicados. No es alerta temprana.
