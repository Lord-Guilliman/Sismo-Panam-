@echo off
cd /d "%~dp0"
echo ================================================
echo       SISMO PANAMA v0.7.1 - MODO DESARROLLO
echo ================================================
where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro Python 3. Instala Python desde python.org
  echo y marca "Add Python to PATH" durante la instalacion.
  pause
  exit /b 1
)
start "Sismo Panama - servidor local" /min cmd /k "cd /d ""%~dp0"" && python server.py"
timeout /t 2 /nobreak >nul
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" http://localhost:8000/
  exit /b
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
  start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" http://localhost:8000/
  exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" http://localhost:8000/
  exit /b
)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" http://localhost:8000/
  exit /b
)
echo No se detecto Chrome o Edge automaticamente.
echo Abre manualmente http://localhost:8000/ en tu navegador.
pause
