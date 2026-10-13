@echo off
setlocal
cd /d "%~dp0"
title NPlay - Instalacao Windows 11
echo.
echo ===== NPLAY IMPORTADOR - INSTALACAO =====
echo.
where py >nul 2>&1
if errorlevel 1 (
 echo Python nao encontrado. Instale Python 3.11 pelo site oficial:
 echo https://www.python.org/downloads/release/python-3119/
 echo Marque Add Python to PATH e execute este arquivo novamente.
 pause
 exit /b 1
)
py -3.11 --version >nul 2>&1
if errorlevel 1 (
 echo Este importador precisa de Python 3.11 de 64 bits.
 echo Instale Python 3.11 e execute novamente.
 pause
 exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
 py -3.11 -m venv .venv
 if errorlevel 1 goto error
)
".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 goto error
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto error
".venv\Scripts\python.exe" -c "import libtorrent; print('libtorrent OK')"
if errorlevel 1 (
 echo.
 echo ATENCAO: Falta uma DLL nativa para o libtorrent.
 echo Instale Microsoft Visual C++ Redistributable x64:
 echo https://aka.ms/vs/17/release/vc_redist.x64.exe
 echo Reinicie o Windows e execute novamente este instalador.
 pause
 exit /b 1
)
if not exist ".env" (
 copy /y ".env.example" ".env" >nul
 echo.
 echo ATENCAO: preencha o arquivo .env com as credenciais privadas.
 echo Nunca envie o .env pelo chat nem para o GitHub.
 notepad ".env"
)
echo.
echo Instalacao concluida. Abra INICIAR-IMPORTADOR.bat.
pause
exit /b 0
:error
echo.
echo Falha na instalacao. Leia as mensagens acima.
pause
exit /b 1
