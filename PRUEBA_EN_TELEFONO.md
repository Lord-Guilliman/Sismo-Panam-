# Guía detallada: probar SismoPanama en tu teléfono

Esta guía separa tres pruebas: escritorio, PWA instalada y notificaciones push remotas. En v0.7.1 solo están listas las dos primeras como pruebas manuales de la interfaz. **El backend push no está desplegado ni configurado; no esperes avisos remotos con la aplicación cerrada.**

## 0. Antes de empezar: entiende qué estás probando

SismoPanama v0.7.1 consulta catálogos públicos que publican eventos después de que la fuente los procesa. Aunque el evento haya ocurrido segundos antes, la fuente puede publicarlo más tarde. Esta versión no detecta el inicio del movimiento en tiempo real y no es un sistema de alerta temprana. No hagas pruebas de emergencia reales ni uses esta PWA como único canal de seguridad.

La página local `http://localhost:8000/` funciona solo en la computadora. Si la escribes en tu teléfono, `localhost` significa el propio teléfono, no tu PC. Para una prueba instalable en el teléfono, usa una dirección HTTPS como GitHub Pages.

## 1. Prueba en la computadora antes de publicar

1. Descarga y extrae el ZIP en una carpeta nueva.
2. Abre la carpeta extraída `SismoPanama_v071` (si tu sistema le añadió un sufijo al extraerla, usa la carpeta equivalente que contiene `index.html`).
3. Ejecuta `iniciar_sismo_panama.bat`.
4. En Chrome de la computadora abre `http://localhost:8000/`.
5. Confirma que el encabezado muestre `v0.7.1` y que, con la pestaña visible, el estado indique aproximadamente `USGS 30 s · IGC-UP 60 s`.
6. Prueba los filtros, la lista, el mapa, la apertura del reporte original y el botón de ubicación. Da permiso de ubicación solo si realmente deseas que el navegador calcule distancias desde tu posición; puedes negarlo y probar las demás funciones.
7. Ejecuta `http://localhost:8000/tests/pruebas.html` y pulsa el control para ejecutar las pruebas de interfaz, si aparece.
8. En otra terminal de Windows, dentro de la carpeta, ejecuta `python tests/test_python.py`. Para el backend, si instalaste sus dependencias, ejecuta `python -m unittest discover -s backend/tests -v`.
9. Si ves una versión anterior, cierra la ventana, vuelve a iniciar el servidor y recarga la página. La caché local puede conservar recursos viejos.

No es un fallo que en segundo plano se reduzca la frecuencia: el navegador puede limitar o suspender temporizadores. No interpretes `30 s` como una garantía de que un reporte aparecerá en 30 segundos.

## 2. Prepara la cuenta GitHub con un seudónimo

Haz esto antes de crear el primer commit público. Las instrucciones detalladas están en `docs/PRIVACIDAD_DEL_MANTENEDOR.md`.

1. Usa un nombre de usuario del proyecto que no reutilices en cuentas personales, redes sociales o foros.
2. En GitHub abre tu avatar → **Settings** → **Emails**.
3. Activa **Keep my email addresses private** y, si aparece, **Block command line pushes that expose my email**.
4. Copia la dirección `noreply` que muestra GitHub para tu cuenta. No inventes una dirección noreply: usa exactamente la que ofrece tu configuración.
5. En **Settings → Public profile**, no añadas nombre legal, empresa, ubicación, web personal ni redes vinculadas si quieres mantener separado el proyecto.
6. Activa la autenticación en dos pasos en **Settings → Password and authentication** y guarda los códigos de recuperación fuera del repositorio.
7. Recuerda que el seudónimo reduce la exposición al público, pero no te vuelve anónimo ante GitHub, tu proveedor de Internet, el hosting ni otros servicios que gestionen registros técnicos.

## 3. Comprueba qué archivos vas a publicar

Lee `QUE_PUBLICAR_Y_QUE_NO.md`. En concreto, no subas `.env` reales, claves privadas VAPID, tokens, topics ntfy, bases de datos, endpoints de suscripción, cookies, archivos `.har`, logs o capturas que revelen datos personales.

Esta edición excluye archivos del editor y el audio personalizado cuya redistribución no he podido verificar. La aplicación usa su alarma sintetizada. Antes de publicar, confirma también que tienes derecho a distribuir los iconos/logotipo que aparecen en `icons/`.

Todo repositorio público puede ser descargado y copiado por cualquiera. GitHub Pages publicará la aplicación a cualquier visitante con la URL; no será un enlace privado.

## 4. Crea un repositorio público vacío

1. Entra en GitHub con tu cuenta de proyecto y pulsa **New repository**.
2. Nombre sugerido: `sismo-panama` (o uno distinto, sin incluir tu nombre legal).
3. Marca **Public** si de verdad deseas que el código sea abierto.
4. No marques “Add a README”, “Add .gitignore” ni “Choose a license”: el proyecto ya contiene esos archivos.
5. Crea el repositorio, pero no subas el ZIP comprimido como un único archivo. GitHub debe recibir los archivos del proyecto, no el ZIP en sí.

### Método recomendado: Git local / GitHub Desktop

Usa GitHub Desktop o Git instalado. Antes del primer commit configura el nombre público de autor que elegiste y la dirección noreply de GitHub. Si usas PowerShell en la carpeta del proyecto, los comandos básicos son:

```powershell
git init
git config --local user.name "SismoPanama Maintainer"
git config --local user.email "TU_DIRECCION_NOREPLY_DE_GITHUB"
git status --short
git add .
git status --short
git diff --cached --stat
```

Reemplaza `TU_DIRECCION_NOREPLY_DE_GITHUB` con el valor real que copiaste de Settings → Emails. Antes de continuar, revisa la lista de archivos en `git status --short`. Si aparece algún archivo personal, no hagas el commit: quítalo del área de preparación y revisa por qué `.gitignore` no lo está excluyendo.

Luego crea el commit y conecta el remoto que GitHub te muestra para el repositorio nuevo:

```powershell
git commit -m "Publica la versión de prueba v0.7.1"
git branch -M main
git remote add origin https://github.com/TU_ALIAS/sismo-panama.git
git push -u origin main
```

Cambia `TU_ALIAS` por el nombre de usuario del proyecto. Si ya existe un repositorio local o `origin`, no repitas `git init` ni `git remote add`: revisa primero `git status` y `git remote -v`.

No es necesario publicar tu dirección real de correo. Los commits seguirán asociados al usuario GitHub que haga el push, y el nombre/alias será visible.

## 5. Activa GitHub Pages

1. En el repositorio abre **Settings → Pages**.
2. En **Build and deployment**, elige **Deploy from a branch**.
3. Selecciona la rama `main` y la carpeta `/(root)` y guarda.
4. Espera a que el despliegue de Pages indique que terminó correctamente.
5. Abre la URL que GitHub muestra, normalmente `https://TU_ALIAS.github.io/sismo-panama/`.
6. Comprueba que el título muestre `v0.7.1`, que cargue el mapa, que funcione la lista y que las fuentes indiquen su estado. Si una fuente falla, anota el mensaje sin publicar datos personales.

El enlace que compartes para usar la app es el de GitHub Pages. El repositorio es el enlace para revisar el código. No actives aún `PUSH_API_BASE`; sigue vacío en esta versión.

## 6. Instala la PWA en Android

1. En tu propio teléfono Android abre **Chrome**.
2. Escribe o pega la URL HTTPS de GitHub Pages; no abras la URL del repositorio de código.
3. Espera a que termine de cargar el mapa y comprueba el número `v0.7.1`.
4. En el menú de Chrome (`⋮`) busca **Instalar aplicación** o **Añadir a pantalla de inicio**. El texto exacto depende de la versión del navegador.
5. Confirma y vuelve a la pantalla de inicio. Abre el icono recién creado.
6. Comprueba que se abre como app, que puedes cambiar filtros y que al volver a conectarte actualiza los reportes.
7. Pulsa “Mi ubicación” solo si quieres probar esa función. Puedes elegir “No permitir”; el mapa y los catálogos deben poder probarse igualmente.
8. Para un test de sonido, activa el sonido desde la interfaz y hazlo con el teléfono a un volumen cómodo. Esta build usa el tono sintetizado; no se incluye un MP3 de licencia pendiente.

### Qué probar y qué esperar

- **Con la app abierta:** la consulta funciona según los intervalos programados, si la fuente y la red responden.
- **Al cambiar de pantalla o bloquear el teléfono:** el navegador puede ralentizar o suspender las consultas. Esta prueba no valida las notificaciones push remotas.
- **Cerrar la app y esperar:** no esperes una nueva alerta remota, porque el backend no está configurado.
- **Modo avión:** los recursos ya cacheados pueden permitir que parte de la interfaz abra, pero las fuentes, el mapa base y las teselas no estarán disponibles sin red. Vuelve a conectar y comprueba la recuperación.
- **Permiso de notificaciones:** conceder permiso no crea un backend ni activa notificaciones remotas por sí solo.

Guarda notas como: fecha/hora de prueba, tipo de teléfono y versión de Android, navegador, URL probada, qué funcionó, errores y si la fuente estaba disponible. No publiques una captura antes de ocultar ubicación exacta, usuario, correo, número telefónico, notificaciones privadas y detalles de red.

## 7. Si usas iPhone

Abre el enlace HTTPS en Safari → **Compartir** → **Añadir a pantalla de inicio**. La compatibilidad de notificaciones web depende de la versión de iOS, de la instalación en pantalla de inicio y de los permisos. La recepción push no se considera probada hasta hacer una prueba remota controlada con backend real.

## 8. Cómo desinstalar y retirar permisos

- Android: mantén pulsado el icono de la PWA → información de la aplicación/desinstalar, o elimínala desde el menú de Chrome. Para permisos del sitio, abre Chrome → Configuración → Configuración de sitios → Notificaciones y localiza el origen.
- iPhone: mantén pulsado el icono de pantalla de inicio y elimínalo. Revisa los permisos de Safari/iOS si concediste alguno.
- En esta versión de prueba no se registra una suscripción Web Push al backend, ya que no hay backend configurado.

## 9. Detente antes de pasar a alertas reales

Antes de habilitar push remoto, despliega y revisa el backend aparte, instala y protege VAPID, configura almacenamiento persistente, límites de abuso, privacidad y monitorización; luego prueba push real en más de un dispositivo. Para alerta temprana real se requiere una ruta técnica y científica diferente descrita en `docs/RUTA_ALERTA_TEMPRANA.md`.
