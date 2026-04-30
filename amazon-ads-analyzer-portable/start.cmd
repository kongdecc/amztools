@echo off
setlocal
cd /d "%~dp0"
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0portable-serve.ps1"
endlocal
