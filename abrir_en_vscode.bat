@echo off
cd /d "%~dp0"
where code >nul 2>nul
if errorlevel 1 (
  echo No se encontro el comando "code" de VS Code.
  echo Abre Visual Studio Code, selecciona Archivo ^> Abrir carpeta...
  echo y elige la carpeta SismoPanama_v04.
  pause
  exit /b 1
)
code .
