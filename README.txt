SISMO PANAMÁ v0.7.1
=================
PWA comunitaria para consultar sismos reportados por USGS e IGC-UP. No es oficial, no predice terremotos ni sustituye a SINAPROC.

ANTES DE PUBLICAR
- Lee PUBLICAR.md; usa el enlace GitHub Pages para compartir la app, no el perfil de GitHub.
- GitHub Pages sirve archivos estáticos. El backend Web Push de referencia está en backend/, pero no se ha desplegado ni configurado; por defecto no habrá avisos remotos con la app cerrada.
- No añadas sonidos con derechos no autorizados. Esta compilación no incluye un MP3 personalizado: usa el tono sintetizado incorporado. No añadas un audio hasta confirmar por escrito su licencia y derecho de redistribución.

DESARROLLO EN WINDOWS
1. Doble clic en iniciar_sismo_panama.bat.
2. Abre http://localhost:8000/
3. Pruebas web: http://localhost:8000/tests/pruebas.html
4. Pruebas Python: python tests/test_python.py

PUBLICACIÓN
Consulta PUBLICAR.md para crear el repositorio público, activar GitHub Pages, configurar el proxy IGC-UP y desplegar el backend push opcional. Lee SECURITY.md antes de invitar colaboradores.

LIMITACIONES IMPORTANTES
- Las fuentes pueden publicar los datos segundos o minutos después y corregir los primeros valores.
- Las alertas locales solo se evalúan cuando la página ejecuta JavaScript; el backend push remoto no está desplegado ni configurado en este ZIP, y tampoco garantiza entrega ni aviso antes del movimiento.
- Modo vigilia consume batería y no es un servicio de alerta garantizado.
- La detección comunitaria permanece desactivada.
- El backend incluido es una referencia para un piloto, no un servicio de emergencia certificado ni de alta disponibilidad.

Antes de subir a GitHub, lee QUE_PUBLICAR_Y_QUE_NO.md y PRUEBA_EN_TELEFONO.md.
