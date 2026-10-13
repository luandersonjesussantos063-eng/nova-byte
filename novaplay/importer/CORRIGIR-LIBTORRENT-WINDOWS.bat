@echo off
setlocal
cd /d "%~dp0"
title NPlay - Corrigir libtorrent Windows 11
echo.
echo ===== NPLAY - REPARO DA DLL DO LIBTORRENT =====
echo Este reparo nao modifica o arquivo .env.
if not exist ".venv\Scripts\python.exe" (
 echo Execute INSTALAR-WINDOWS-11.bat primeiro.
 pause
 exit /b 1
)
echo.
echo Verificando a versao instalada...
".venv\Scripts\python.exe" -m pip show libtorrent
echo.
echo Tentando reinstalar libtorrent 2.0.11 sem cache...
".venv\Scripts\python.exe" -m pip install --force-reinstall --no-cache-dir --only-binary=:all: libtorrent==2.0.11
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -c "import libtorrent as lt; print('LIBTORRENT OK:', lt.version)"
if not errorlevel 1 goto success
echo.
echo A DLL continua falhando. Tentando a versao alternativa 2.0.15...
".venv\Scripts\python.exe" -m pip install --force-reinstall --no-cache-dir --only-binary=:all: libtorrent==2.0.15
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -c "import libtorrent as lt; print('LIBTORRENT OK:', lt.version)"
if not errorlevel 1 goto success
echo.
echo A DLL ainda nao carregou. Pode faltar uma dependencia do Windows.
echo Confirme que o Microsoft Visual C++ Redistributable x64 foi instalado.
echo https://aka.ms/vs/17/release/vc_redist.x64.exe
echo Envie somente as mensagens de erro acima, nunca seu .env.
pause
exit /b 1
:success
echo.
echo REPARO CONCLUIDO. Execute INICIAR-IMPORTADOR.bat.
pause
exit /b 0
:failed
echo.
echo Falha ao instalar a versao alternativa. Copie a mensagem acima.
pause
exit /b 1
