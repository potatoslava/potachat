@echo off
title PotaChat
echo Starting PotaChat...

start "PotaChat Server" cmd /k "cd /d "%~dp0server" && npm run dev"
timeout /t 2 /nobreak >nul
start "PotaChat Client" cmd /k "cd /d "%~dp0client" && npm run dev"
timeout /t 3 /nobreak >nul

start http://localhost:3000
