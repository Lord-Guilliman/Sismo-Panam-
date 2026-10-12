# Ruta técnica: de catálogo sísmico a una posible alerta temprana

## Estado actual

Sismo Panamá v0.7.1 es una PWA que consulta catálogos sísmicos públicos y muestra eventos después de que una fuente publica o actualiza el reporte. Consulta periódica más rápida no equivale a detectar el inicio del movimiento. Web Push puede distribuir una notificación después de que el backend detecta un evento publicado, pero no adelanta el reporte de la fuente.

## Qué es alerta temprana de verdad

Un sistema de Earthquake Early Warning no predice el terremoto. Detecta que un terremoto ya comenzó, estima rápidamente su localización y el movimiento esperado, y comunica una advertencia a lugares que todavía no han recibido las ondas más fuertes. Los sistemas serios utilizan datos de sensores sísmicos en tiempo real y algoritmos evaluados, o redes de teléfonos a gran escala como un sistema complementario. Una PWA que consulta el catálogo cada 30 segundos no puede cumplir esa función.

Referencias públicas para leer primero:

- USGS, explicación de ShakeAlert: https://www.usgs.gov/programs/earthquake-hazards/science/earthquake-early-warning-overview
- USGS, principios del sistema: https://www.usgs.gov/media/images/shakealert-earthquake-early-warning-basics
- Google, cómo funciona Android Earthquake Alerts: https://research.google/blog/android-earthquake-alerts-a-global-system-for-early-warning/
- Ayuda oficial de Android, cobertura y limitaciones: https://support.google.com/android/answer/9319337?hl=es
- Agencia Meteorológica de Japón, Earthquake Early Warning: https://www.jma.go.jp/jma/en/Activities/eew.html
- Instituto de Geociencias de la Universidad de Panamá, contacto: https://geociencias.up.ac.pa/contacto
- Instituto de Geociencias, servicios y monitoreo: https://www.geociencias.up.ac.pa/servicios

La lista oficial de países con Android Earthquake Alerts consultada para esta versión no incluye Panamá. La disponibilidad puede cambiar, por lo que conviene comprobarla directamente en la ayuda de Google cuando se haga una nueva revisión.

## Fases recomendadas

### Fase 1 — Hacer confiable el informador actual

- Registrar hora del evento, hora de publicación observada, hora de recepción por la app y revisión del reporte, distinguiendo esos tiempos.
- Probar duplicados, actualización de magnitud, desconexiones, respuestas vacías y datos incorrectos.
- Mostrar la antigüedad de cada fuente y no ocultar el estado de desactualización.
- Conservar el lenguaje “sismo reportado”; no usar “alerta temprana” en la UI.

### Fase 2 — Consultar al ecosistema científico y de emergencias

Solicitar una conversación técnica con el Instituto de Geociencias de la Universidad de Panamá y estudiar la coordinación pertinente con SINAPROC. Preguntar qué datos en tiempo real existen, qué latencias tienen, qué políticas de distribución aplican y qué protocolo debe seguir una aplicación ciudadana. No asumir que un feed de catálogo público puede usarse como feed de detección temprana.

### Fase 3 — Definir una fuente de detección en tiempo real

Con especialistas, determinar si se dispone de señales de estaciones sísmicas/strong-motion en tiempo real, telemetría de baja latencia, metadatos de estaciones, reloj sincronizado y autorización de uso. Si no existe acceso a esos datos, la aplicación no podrá generar una alerta temprana científica a partir de los catálogos actuales.

### Fase 4 — Investigación y validación

- Construir prototipos en modo sombra que solo registren estimaciones, sin avisar al público.
- Medir falsos positivos, eventos perdidos, error de localización/magnitud, latencia y tiempo de aviso potencial por región.
- Validar con eventos históricos y ejercicios acordados con los expertos; documentar limitaciones cerca del epicentro, donde puede no haber tiempo de aviso.
- Someter la lógica a revisión sismológica, auditoría de seguridad, pruebas de carga y revisión de privacidad.

### Fase 5 — Distribución con responsabilidades claras

Los canales críticos podrían requerir app nativa, infraestructura redundante, operadores de guardia y acuerdos con autoridades/telecomunicaciones. Una notificación de navegador común no tiene la misma prioridad ni garantías que un canal oficial del sistema operativo. No se debe prometer que puede sobrepasar silencioso, ahorro de batería o restricciones del sistema operativo.

### Fase 6 — Piloto institucional

Solo tras una validación científica y operativa se debe proponer un piloto formal. Definir responsables, financiación, mantenimiento, disponibilidad, contacto público, gestión de incidentes, actualización de criterios, auditorías periódicas y un acuerdo con las autoridades competentes. Mantener el servicio informativo claramente separado del aviso oficial hasta que exista autorización expresa.

## Lo que no se debe hacer

- No activar un detector por acelerómetro en la PWA y llamarlo sistema de alerta temprana sin validación de señal, agrupación de múltiples sensores y evaluación de falsos positivos.
- No mandar avisos críticos basados solo en un dato comunitario sin confirmación.
- No usar el catálogo posterior al evento como fuente “en vivo” de ondas sísmicas.
- No anunciar esta versión como alternativa a Android Earthquake Alerts, al IGC-UP o a los canales oficiales.
