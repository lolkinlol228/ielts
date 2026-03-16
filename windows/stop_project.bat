@echo off
setlocal
title IELTS Center - Stop

echo [SYSTEM] Останавливаю процессы на портах 3000 и 8001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8001 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>nul

echo [SYSTEM] Готово.
pause
