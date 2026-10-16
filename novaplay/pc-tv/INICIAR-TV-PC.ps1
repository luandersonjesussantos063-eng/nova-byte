param([switch]$HttpsFornecedorConfirmado)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$folder = Join-Path $env:LOCALAPPDATA 'NPlay\TV-PC'
New-Item -ItemType Directory -Force -Path $folder | Out-Null
Set-Location $folder
$source = 'https://raw.githubusercontent.com/luandersonjesussantos063-eng/nova-byte/main/novaplay/pc-tv/'
foreach ($name in @('bridge.mjs','transport.mjs','xtream-client.mjs','media-engine.mjs','provider-tls.mjs','Dockerfile','compose.yaml','INICIAR-TV-PC.ps1','REPARAR-CONEXAO.ps1','PARAR-TV-PC.bat','README.md')) {
    Invoke-WebRequest -UseBasicParsing ($source + $name) -OutFile (Join-Path $folder $name)
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Instale/abra o Docker Desktop antes de iniciar a TV-PC.' }
& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Abra o Docker Desktop, aguarde ele iniciar e execute este comando novamente.' }
if (-not (Test-Path '.env')) {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes); $rng.Dispose()
    $secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })
    [IO.File]::WriteAllText((Join-Path $folder '.env'), "NPLAY_BRIDGE_KEY=$secret`n", (New-Object Text.UTF8Encoding($false)))
}
if ($HttpsFornecedorConfirmado) {
    # Public certificate SHA-256 compared on the PC and the owner's phone.
    # This opt-in affects ONLY this host and does not change Windows trust.
    $config = @(Get-Content '.env' | Where-Object { $_ -notmatch '^NPLAY_TLS_PINNED_(HOST|SHA256)=' })
    $config += 'NPLAY_TLS_PINNED_HOST=pulsando23cod07.fyi'
    $config += 'NPLAY_TLS_PINNED_SHA256=E2624F0B26B7600C5745CE096D7EB8168928B21BD7C9874F3E208BCBEC6C25D2'
    [IO.File]::WriteAllText((Join-Path $folder '.env'), (($config -join "`n") + "`n"), (New-Object Text.UTF8Encoding($false)))
    $env:NPLAY_TLS_PINNED_HOST = 'pulsando23cod07.fyi'
    $env:NPLAY_TLS_PINNED_SHA256 = 'E2624F0B26B7600C5745CE096D7EB8168928B21BD7C9874F3E208BCBEC6C25D2'
    Write-Host 'HTTPS configurado para o certificado conferido neste fornecedor.'
}
Write-Host 'Preparando TV-PC. Na primeira vez, o Docker vai baixar os componentes...'
& docker compose -p nplay-tv-pc up -d --build
if ($LASTEXITCODE -ne 0) { throw 'O Docker nao conseguiu iniciar a ponte. Confira o erro acima.' }
& (Join-Path $folder 'REPARAR-CONEXAO.ps1')
