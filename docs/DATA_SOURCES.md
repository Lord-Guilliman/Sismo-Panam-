# Fuentes de datos

## Fuentes principales del frontend

- **USGS FDSN Event API:** `https://earthquake.usgs.gov/fdsnws/event/1/`. La web solicita el catálogo para una región geográfica centrada en Panamá y alrededores. El contenido, la disponibilidad y los tiempos de publicación dependen del USGS.
- **Instituto de Geociencias de la Universidad de Panamá (IGC-UP):** `https://sismosgeociencias.up.ac.pa/`. El frontend interpreta la tabla pública cuando el navegador permite el acceso; si CORS bloquea la consulta, puede ser necesario el proxy de lectura opcional.

## Backend Web Push v0.7.1

La primera versión del monitor remoto consulta el catálogo USGS por separado. No consulta IGC-UP. Esto reduce dependencias y evita afirmar que el monitor remoto cubre una fuente que todavía no integra.

## Reglas de presentación

- Mostrar fuente original y enlazar al reporte cuando exista un enlace seguro.
- Los valores iniciales pueden ser preliminares y cambiar.
- No combinar eventos como si su identificación fuera infalible; usar reglas de deduplicación comprobables.
- Un campo o bandera de posible tsunami en un catálogo no debe mostrarse como una alerta oficial vigente. Remitir a autoridades competentes.
- Los catálogos pueden sufrir caídas, retardos o cambios de formato. Mostrar los errores y la hora de última recepción.

## Uso de marcas y datos de terceros

Los nombres USGS e IGC-UP identifican la procedencia de los datos; no implican patrocinio o aprobación. Revisa las condiciones y políticas actuales de cada proveedor antes de desplegar a gran escala. Los logos de Sismo Panamá y otros recursos también deben tener procedencia/licencia documentada.
