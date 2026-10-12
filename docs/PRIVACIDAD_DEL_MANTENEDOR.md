# Privacidad del mantenedor: publicar con seudónimo

Esta guía ayuda a separar la identidad personal de la identidad pública del proyecto. No promete anonimato absoluto.

## 1. Elige una identidad pública independiente

- Usa un alias único para Sismo Panamá que no sea tu nombre ni el nombre de usuario que ya utilizas en redes personales.
- No recicles avatar, biografía, enlaces, dominio, nombre de empresa ni correo que permita conectar fácilmente con otras cuentas.
- No añadas nombre legal, ciudad, centro de estudios, empleador, teléfono ni perfiles personales a tu perfil público del proyecto.
- Considera crear un correo dedicado al proyecto, con un nombre neutro. Debe ser recuperable y estar protegido; no uses un correo temporal descartable.
- Si más adelante hablas con una institución, puedes conservar el alias públicamente y acordar un canal privado para las comunicaciones formales. Una adopción/contratación oficial puede requerir identidad legal fuera del repositorio público.

## 2. Oculta la dirección de correo de los commits

1. En GitHub abre avatar → **Settings** → **Emails**.
2. Activa **Keep my email addresses private**.
3. Activa **Block command line pushes that expose my email**, si aparece.
4. Copia la dirección `noreply` exacta mostrada por GitHub.
5. Antes del primer commit local, configura el autor en este repositorio, no necesariamente para todos los repositorios del ordenador:

```powershell
git config --local user.name "SismoPanama Maintainer"
git config --local user.email "PEGA_AQUI_TU_NOREPLY_DE_GITHUB"
```

El `user.name` queda visible en metadatos del commit; elige un seudónimo. La dirección noreply es un mecanismo de privacidad del email, no anonimato frente a GitHub. Los commits antiguos no cambian automáticamente si después cambias los ajustes.

## 3. Protege la cuenta

- Activa 2FA con una passkey o app autenticadora y guarda los códigos de recuperación sin conexión.
- Usa una contraseña única y no compartas tokens de acceso.
- Revisa aplicaciones OAuth conectadas y retira las que no uses.
- Para máxima separación, utiliza un perfil de navegador dedicado al proyecto y evita iniciar sesión en tus cuentas personales dentro de ese perfil.

## 4. Qué puede revelar accidentalmente tu identidad

- Datos de autor y fecha/hora de cada commit, el nombre de la cuenta y el historial público.
- Correos, enlaces sociales, nombres de usuario repetidos y capturas de pantalla.
- Historial Git de repositorios existentes. Un archivo eliminado después puede seguir accesible en commits anteriores.
- Metadatos de documentos, fotografías o capturas; este paquete no contiene una carpeta `.git` y los metadatos EXIF de las imágenes que se inspeccionaron estaban vacíos, pero revisa cada nuevo archivo que añadas.
- Un dominio personalizado, el proveedor de hosting, pagos, registros del servidor o comunicaciones institucionales pueden exigir o conservar datos reales.

La cuenta y el proveedor conocen más datos de los que el público ve. Un alias no protege frente a la plataforma, al proveedor de Internet ni a procesos legales aplicables. No prometas anonimato total.

## 5. No subas los datos operativos

Usa `QUE_PUBLICAR_Y_QUE_NO.md`. En especial, deja fuera `.env` reales, `*.pem`, claves privadas VAPID, bases de datos, endpoints de suscripciones push, temas secretos de ntfy, cookies de navegador, logs y capturas con información privada. El archivo `.gitignore` protege al trabajar con Git, pero no sustituye la revisión manual antes de subir.

## 6. Mantén una historia de proyecto auténtica

La mejor forma de demostrar que el proyecto evoluciona es registrar decisiones reales:

- Mantén `CHANGELOG.md` con cambios verificables.
- Describe en `README.md` el propósito del proyecto, sus límites y lo que sí funciona hoy.
- Haz commits pequeños y con mensajes concretos; no fabriques fechas, autores ni una historia de commits que no existió.
- Conserva las partes del código que entiendes y puedes explicar. Revisa y prueba cada cambio que aceptes.
- No es necesario alterar artificialmente el código para “parecer humano”. Los detectores de texto/código generado no son una prueba fiable de autoría. Si te preguntan, puedes explicar que el proyecto nació como iniciativa propia y que has usado herramientas de apoyo para revisión, pruebas y documentación cuando corresponda.

La atribución de derechos debe ser honesta: no atribuyas a ti todo código de terceros sin la licencia correspondiente y no afirmes que has auditado un componente si solo ejecutaste pruebas automatizadas.
