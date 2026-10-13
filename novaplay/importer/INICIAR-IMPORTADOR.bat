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
".venv\Scripts\python.exe" -c "import libtorrent; print('libtorrent OK')" >nul 2>&1
if errorlevel 1 (
 echo ERRO: o Windows nao conseguiu carregar a DLL do libtorrent.
 echo Instale o Microsoft Visual C++ Redistributable x64:
 echo https://aka.ms/vs/17/release/vc_redist.x64.exe
 echo Depois reinicie o computador e tente novamente.
 echo Se continuar, envie a mensagem do erro, sem mostrar o arquivo .env.
 pause
 exit /b 1
)
echo NPlay: iniciando importador local...
echo Mantenha esta janela aberta enquanto importa.
".venv\Scripts\python.exe" worker.py
echo.
echo O importador parou. Verifique o erro acima.
pause
