$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$folder = Join-Path $env:LOCALAPPDATA 'NPlay\TV-PC'
if (-not (Test-Path (Join-Path $folder 'compose.yaml'))) { throw 'A TV-PC nao esta instalada nesta conta do Windows.' }

# Read the actual running container, not a possibly overridden .env file.
# The key is captured into memory and is never printed to the terminal.
$nodeCheck = "(async()=>{for(let i=0;i<12;i++){try{const secret=process.env.NPLAY_BRIDGE_KEY;if(!/^[a-f0-9]{64}$/.test(secret||''))throw Error('Invalid key');const r=await fetch('http://127.0.0.1:8788/health',{headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(2000)});const info=await r.json();if(!r.ok||info.service!=='nplay-pc-tv')throw Error('Invalid bridge');process.stdout.write(JSON.stringify({secret,version:info.version}));return;}catch{await new Promise(r=>setTimeout(r,500));}}console.error('A ponte nao respondeu ao teste local.');process.exitCode=1;})()"
$raw = (& docker compose -p nplay-tv-pc --project-directory $folder exec -T bridge node -e $nodeCheck | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel conferir a ponte em execucao. Abra o Docker e inicie a TV-PC.' }
try { $info = $raw | ConvertFrom-Json } catch { throw 'A ponte nao retornou uma identificacao valida.' }
if ($info.secret -notmatch '^[a-f0-9]{64}$') { throw 'A chave da ponte em execucao esta em formato invalido.' }

$url = $null
for ($i=0; $i -lt 12; $i++) {
    $logs = (& docker compose -p nplay-tv-pc --project-directory $folder logs --no-color --tail 1000 tunnel 2>$null | Out-String)
    $addresses = [regex]::Matches($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($addresses.Count -gt 0) { $url = $addresses[$addresses.Count-1].Value; break }
    Start-Sleep -Milliseconds 500
}
if (-not $url) { throw 'O tunel nao informou o endereco atual. Inicie a TV-PC novamente.' }

# Confirm that this exact tunnel accepts this exact container key before writing.
try {
    $remote = Invoke-RestMethod -Uri ($url + '/health') -Headers @{Authorization=('Bearer ' + $info.secret)} -TimeoutSec 20
} catch {
    throw 'O tunel atual nao confirmou a chave da ponte. O arquivo anterior foi preservado. Confira se o servico tunnel esta ligado.'
}
if ($remote.service -ne 'nplay-pc-tv') { throw 'O endereco respondeu, mas nao identificou a ponte TV-PC. O arquivo anterior foi preservado.' }
$connection = "ENDERECO DO PC: $url`r`nCHAVE DO PC: $($info.secret)`r`n`r`nConexao conferida com a ponte em execucao.`r`nNo ADM, use Carregar CONEXAO-ADM.txt e clique em Conectar PC.`r`nMantenha os canais em rascunho enquanto testa o receptor."
[IO.File]::WriteAllText((Join-Path $folder 'CONEXAO-ADM.txt'), $connection, (New-Object Text.UTF8Encoding($false)))
Write-Host "Conexao conferida: TV-PC $($info.version). Arquivo CONEXAO-ADM.txt atualizado sem trocar a chave."
Start-Process notepad.exe (Join-Path $folder 'CONEXAO-ADM.txt')
Start-Process 'https://novabytesolucoes.com.br/novaplay/admin/'
