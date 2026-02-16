# PEANUT-AGENT - 1-command installer (Windows PowerShell)
#
# Usage:
#   cd <repo>
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
#
# What it does:
# - Creates/uses .venv
# - Installs deps (requirements.txt)
# - Runs the wizard inside the venv

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

try {
  chcp 65001 > $null
  $OutputEncoding = [System.Text.UTF8Encoding]::new()
} catch {}

function Resolve-Python {
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $cmd = Get-Command py -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  throw "Python not found. Install Python 3.10+ (or enable the 'py' launcher) and retry."
}

$Py = Resolve-Python

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
  Write-Host "[1/3] Creating virtual env (.venv)..." -ForegroundColor Yellow
  if ($Py -like "*\py.exe") {
    & $Py -3 -m venv .venv
  } else {
    & $Py -m venv .venv
  }
}

$VenvPy = ".\.venv\Scripts\python.exe"

Write-Host "[2/3] Installing dependencies..." -ForegroundColor Yellow
& $VenvPy -m pip install --upgrade pip
& $VenvPy -m pip install -r requirements.txt

Write-Host "[3/3] Running wizard..." -ForegroundColor Yellow
& $VenvPy .\wizard.py
