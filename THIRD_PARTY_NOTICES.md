# Avisos de terceros y procedencia de recursos

Mantén este inventario actualizado antes de publicar nuevos recursos o cambiar proveedores.

| Componente o servicio | Uso | Referencia / acción |
|---|---|---|
| Leaflet 1.9.4 | Motor de mapa cargado desde un CDN con SRI (integridad de recurso) | Proyecto Leaflet: https://leafletjs.com/ ; revisar licencia incluida en la distribución/aviso correspondiente antes de redistribuir archivos copiados localmente. |
| OpenStreetMap | Teselas del mapa | Atribución visible en el mapa (`© OpenStreetMap contributors`); revisar política de uso de teselas: https://operations.osmfoundation.org/policies/tiles/ . No asumir que el servicio público es ilimitado. |
| USGS FDSN Event API | Catálogo sísmico | https://earthquake.usgs.gov/fdsnws/event/1/ ; fuente de los reportes de USGS, no patrocinador del proyecto. |
| IGC-UP | Catálogo público de Panamá | https://sismosgeociencias.up.ac.pa/ ; fuente independiente, no patrocinador del proyecto. |
| Cloudflare Worker (opcional) | Proxy de lectura para resolver CORS | Requiere cuenta y configuración del propietario. Revisar términos y límites vigentes. |
| pywebpush / FastAPI / Uvicorn (backend opcional) | API y envío Web Push | Dependencias definidas en `backend/requirements.txt`; revisar avisos de dependencias al desplegar. |
| Audio personalizado | Alarma de la PWA | Excluido de esta compilación de prueba hasta verificar derechos de redistribución; se utiliza un tono sintetizado local. |
| Logotipos e iconos dentro de `icons/` | Identidad visual | Verificar autoría/derechos del proyecto y documentar los recursos importados. |

Este archivo es una lista inicial basada en las referencias del proyecto, no una auditoría completa de licencias. Si no se puede confirmar el derecho de redistribución de un recurso, retíralo del paquete público hasta resolverlo.
