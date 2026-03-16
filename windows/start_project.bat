@echo off
setlocal EnableExtensions
title IELTS Center - Full Start

set "SCRIPT_DIR=%~dp0"

echo [SYSTEM] Запускаю backend и frontend в отдельных окнах...
start "IELTS Backend" cmd /k ""%SCRIPT_DIR%start_backend.bat""
timeout /t 3 >nul
start "IELTS Frontend" cmd /k ""%SCRIPT_DIR%start_frontend.bat""
timeout /t 4 >nul
start "" "http://localhost:3000"

echo [SYSTEM] Готово. Если сайт не открылся сразу, подождите 20-60 секунд.
exit /b 0
