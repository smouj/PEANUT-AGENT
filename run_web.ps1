$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

$VenvPy = ".\.venv\Scripts\python.exe"
if (-not (Test-Path $VenvPy)) {
  Write-Host "No encuentro .venv. Ejecuta primero: .\install.ps1" -ForegroundColor Red
  exit 1
}

& $VenvPy .\web_ui.py @args
