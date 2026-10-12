# Política de alertas

## Significado

Una alerta de Sismo Panamá significa que una fuente configurada publicó o actualizó un reporte que cumple criterios informativos. **No predice terremotos, no confirma daños y no equivale a alerta temprana oficial.** El usuario debe seguir las instrucciones de SINAPROC y de los organismos competentes.

## Fuentes y orden de confianza

- La visualización web combina reportes USGS e IGC-UP con lógica de deduplicación documentada en `core.js`.
- El backend remoto v0.7.1 usa USGS exclusivamente. La notificación identifica esa fuente.
- No se envían push basados en acelerómetros comunitarios. `ENABLE_COMMUNITY` permanece `false`.

## Intervalos y retrasos

- Frontend visible: USGS 30 segundos; IGC-UP 60 segundos.
- Modo vigilia: USGS 15 segundos; IGC-UP 30 segundos.
- Pestaña oculta: USGS cada 120 s e IGC-UP cada 180 s; el navegador/sistema pueden suspenderlas.
- Backend remoto opcional: intervalo por defecto 30 segundos, con mínimo de 30. El retraso de entrega incluye publicación de la fuente, espera del siguiente sondeo, red, proveedor push y sistema operativo. No se promete un límite máximo de entrega.

## Reglas del backend remoto v0.7.1

- Consulta el catálogo USGS para la región configurada.
- Solo contempla eventos ocurridos hace un máximo de 15 minutos durante el ciclo de envío.
- Cada suscripción selecciona un umbral de 3.5 a 6.0. El usuario puede cambiarlo o cancelar la suscripción.
- Evita repetir la misma magnitud para la misma suscripción y evento. Envía una actualización si la magnitud aumenta al menos 0.5.
- Las suscripciones que el proveedor considera expiradas (404/410) se eliminan.
- No se utiliza una ubicación precisa de la persona en el filtro remoto actual; por ello los avisos están limitados a los eventos de la región de Panamá configurada, no a una distancia individual.

## Comunicación de errores

- Si una fuente falla, la UI debe mostrarlo y la antigüedad de los datos.
- Un error de monitor o de envío push se registra sin escribir endpoints o secretos en los logs.
- La falta de recepción de una notificación nunca debe interpretarse como prueba de que no hubo un sismo.

## Tsunami y emergencias

No se genera ni se infiere una alerta oficial de tsunami a partir de un campo de USGS. Los usuarios deben consultar avisos oficiales. El texto de una notificación debe mantener el carácter informativo y recomendar seguir a las autoridades.
