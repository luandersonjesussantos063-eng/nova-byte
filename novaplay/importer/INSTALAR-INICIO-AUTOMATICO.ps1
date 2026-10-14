$ErrorActionPreference = 'Stop'
$nplayRoot = $PSScriptRoot
$nplayPython = Join-Path $nplayRoot '.venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $nplayPython)) { throw 'Instale primeiro o ambiente Python do importador.' }
$action = New-ScheduledTaskAction -Execute $nplayPython -Argument ('"' + (Join-Path $nplayRoot 'supervisor.py') + '"') -WorkingDirectory $nplayRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'NPlay Importador' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
$validationAction = New-ScheduledTaskAction -Execute $nplayPython -Argument ('"' + (Join-Path $nplayRoot 'validate_existing.py') + '"') -WorkingDirectory $nplayRoot
$validationTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName 'NPlay Validacao de Videos' -Action $validationAction -Trigger $validationTrigger -Settings $settings -Principal $principal -Force | Out-Null
Start-Process -FilePath $nplayPython -ArgumentList ('"' + (Join-Path $nplayRoot 'supervisor.py') + '"') -WorkingDirectory $nplayRoot -WindowStyle Hidden
Write-Output 'NPlay: início automático configurado para esta conta. Logs na pasta logs.'
