@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo No se encontro Python. Instala Python 3 y vuelve a intentarlo.
  pause
  exit /b 1
)
python server.py
pause
