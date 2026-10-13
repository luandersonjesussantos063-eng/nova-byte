@echo off
setlocal
cd /d "%~dp0"
title NPlay - Importador R2
if not exist ".venv\Scripts\python.exe" (
 echo Primeiro execute INSTALAR-WINDOWS-11.bat
 pause
 exit /b 1
)
if not exist ".env" (
 echo Arquivo .env nao encontrado. Execute INSTALAR-WINDOWS-11.bat
 pause
 exit /b 1
)
echo NPlay: iniciando importador local...
echo Mantenha esta janela aberta enquanto importa.
".venv\Scripts\python.exe" worker.py
echo.
echo O importador parou. Verifique o erro acima.
pause
