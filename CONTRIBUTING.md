# Contribuir a Sismo Panamá

Gracias por querer mejorar un proyecto de información sísmica. La prioridad es que los datos, las limitaciones y las advertencias de seguridad se comuniquen con honestidad.

## Antes de proponer un cambio

1. Abre una issue para cambios grandes o que modifiquen la lógica de alertas.
2. No compartas vulnerabilidades en issues públicos; sigue `SECURITY.md`.
3. No publiques contraseñas, tokens, claves VAPID privadas, tokens de push, datos personales ni archivos de configuración del entorno.
4. No añadas recursos sin licencia compatible/documentada. Actualiza `THIRD_PARTY_NOTICES.md`.
5. No cambies el lenguaje de la app para insinuar predicción, alerta temprana, respaldo oficial o certeza no demostrada.

## Cómo trabajar localmente

- Frontend: `iniciar_sismo_panama.bat`, luego abre `http://localhost:8000/`.
- Pruebas de reglas web: `http://localhost:8000/tests/pruebas.html`.
- Pruebas Python: `python tests/test_python.py`.
- Sintaxis JavaScript con Node.js: `node --check app.js`, `node --check core.js`, `node --check push-client.js`.
- Backend push: `python -m venv .venv`, instala `backend/requirements.txt` y ejecuta las pruebas de `backend/tests/` según `backend/README.md`. El script `notificador_ntfy.py` es una herramienta personal separada descrita en `docs/PERSONAL_NTFY.md`. No actives el monitor con credenciales reales durante una prueba unitaria.

## Reglas para cambios de alerta

- Mantén el ID de la fuente, hora del evento y enlace original.
- Evita notificaciones repetidas ante el mismo evento; contempla cambios de magnitud y reportes preliminares.
- No conviertas un indicador de tsunami del catálogo en una alerta oficial de tsunami.
- No actives la detección comunitaria por acelerómetro para usuarios públicos sin revisión de abuso, privacidad, validación y metodología.
- Añade pruebas de eventos duplicados, antiguos, malformados, revisados y sin coordenadas.
- Incluye en la UI la edad de los datos y errores de conectividad. No muestres “todo bien” si las fuentes están caídas.

## Flujo de revisión

1. Usa una rama descriptiva y un cambio acotado.
2. Incluye pruebas y actualiza documentación/cambios.
3. Abre un pull request con el propósito, riesgos y cómo se probó.
4. Espera una revisión antes de incorporar cambios a `main`.

Las pruebas automáticas ayudan, pero no sustituyen las pruebas en navegador y teléfono. El proyecto se comparte sin garantía de idoneidad para emergencias.
