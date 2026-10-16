$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$folder = Join-Path $env:LOCALAPPDATA 'NPlay\TV-PC'
New-Item -ItemType Directory -Force -Path $folder | Out-Null
Set-Location $folder
$source = 'https://raw.githubusercontent.com/luandersonjesussantos063-eng/nova-byte/main/novaplay/pc-tv/'
foreach ($name in @('bridge.mjs','Dockerfile','compose.yaml','INICIAR-TV-PC.ps1','PARAR-TV-PC.bat','README.md')) {
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
$secret = ((Get-Content '.env' | Where-Object { $_ -match '^NPLAY_BRIDGE_KEY=' }) -replace '^NPLAY_BRIDGE_KEY=','').Trim()
Write-Host 'Preparando TV-PC. Na primeira vez, o Docker vai baixar os componentes...'
& docker compose -p nplay-tv-pc up -d --build
if ($LASTEXITCODE -ne 0) { throw 'O Docker nao conseguiu iniciar a ponte. Confira o erro acima.' }
$url = $null
for ($i=0; $i -lt 45; $i++) {
    $logs = (& docker compose -p nplay-tv-pc logs --no-color --tail 100 tunnel 2>&1 | Out-String)
    $matchesFound = [regex]::Matches($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($matchesFound.Count -gt 0) { $url = $matchesFound[$matchesFound.Count-1].Value; break }
    Start-Sleep -Seconds 2
}
if (-not $url) { throw 'O tunel ainda nao gerou o endereco. Execute novamente; nao e preciso reinstalar.' }
$connection = "ENDERECO DO PC: $url`r`nCHAVE DO PC: $secret`r`n`r`nCole no ADM NPlay > Canais > TV pelo PC.`r`nMantenha o Docker e o PC ligados. Ao reiniciar, execute este script e confira se o endereco mudou."
[IO.File]::WriteAllText((Join-Path $folder 'CONEXAO-ADM.txt'), $connection, (New-Object Text.UTF8Encoding($false)))
Write-Host "`nTV-PC iniciada. O arquivo CONEXAO-ADM.txt contem os dois campos para o ADM."
Start-Process notepad.exe (Join-Path $folder 'CONEXAO-ADM.txt')
Start-Process 'https://novabytesolucoes.com.br/novaplay/admin/'
