$ErrorActionPreference = 'Stop'
$base = (Get-Location).Path
if (!(Test-Path (Join-Path $base 'pipeline.py')) -or !(Test-Path (Join-Path $base '.venv\Scripts\python.exe'))) {
    throw 'Execute este comando dentro da pasta do importador NPlay, onde ficam pipeline.py e INICIAR-IMPORTADOR.bat.'
}
$stopFile = Join-Path $base 'importer.stop'
New-Item -Path $stopFile -ItemType File -Force | Out-Null
Write-Host 'Aguardando a importacao atual terminar e o supervisor parar. Nao feche o FFmpeg.'
$deadline = (Get-Date).AddHours(4)
$lockPath = Join-Path $base 'supervisor.lock'
$ready = $false
while (!$ready) {
    $stream = $null
    try {
        $stream = [System.IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'ReadWrite')
        $stream.Lock(0, 1)
        $stream.Unlock(0, 1)
        $ready = $true
    } catch {
        if ((Get-Date) -gt $deadline) { throw 'Importador ainda ocupado. Aguarde terminar e execute novamente.' }
        Start-Sleep -Seconds 5
    } finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
}
# Refuse an independently launched worker that is not owned by the supervisor.
$standalone = Get-CimInstance Win32_Process -Filter "name = 'python.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains($base) -and $_.CommandLine -match '(worker|pipeline)\.py'
}
if ($standalone) { throw 'Ainda existe um processador em execucao. Aguarde encerrar antes de atualizar.' }
$stage = Join-Path $base ('.update-' + [guid]::NewGuid().ToString())
New-Item -Path $stage -ItemType Directory | Out-Null
try {
    foreach ($name in @('cleanup.py', 'streaming.py', 'pipeline.py')) {
        Invoke-WebRequest -UseBasicParsing -Uri ('https://novabytesolucoes.com.br/novaplay/importer/' + $name + '?update=adaptive1') -OutFile (Join-Path $stage $name)
    }
    & (Join-Path $base '.venv\Scripts\python.exe') -m py_compile (Join-Path $stage 'cleanup.py') (Join-Path $stage 'streaming.py') (Join-Path $stage 'pipeline.py')
    if ($LASTEXITCODE -ne 0) { throw 'Validacao dos arquivos falhou. Nenhum arquivo instalado.' }
    # Install dependency first; the previous worker does not use it.
    Move-Item -Force (Join-Path $stage 'cleanup.py') (Join-Path $base 'cleanup.py')
    Move-Item -Force (Join-Path $stage 'streaming.py') (Join-Path $base 'streaming.py')
    Move-Item -Force (Join-Path $stage 'pipeline.py') (Join-Path $base 'pipeline.py')
    Write-Host 'Atualizado. Limpando somente importacoes publicadas e confirmadas no R2...'
    & (Join-Path $base '.venv\Scripts\python.exe') (Join-Path $base 'worker.py') --cleanup-only
    if ($LASTEXITCODE -ne 0) { throw 'A limpeza nao terminou. Confira a conexao e inicie o importador novamente.' }
    Write-Host 'Pronto. Iniciando importador com limpeza e streaming adaptativo.'
    Start-Process -FilePath (Join-Path $base 'INICIAR-IMPORTADOR.bat') -WorkingDirectory $base
} finally {
    Remove-Item -Recurse -Force $stage
}
