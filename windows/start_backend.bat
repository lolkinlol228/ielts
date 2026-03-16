@echo off
setlocal EnableExtensions EnableDelayedExpansion
title IELTS Center Backend

set "ROOT_DIR=%~dp0.."
set "BACKEND_DIR=%ROOT_DIR%\backend"

echo [BACKEND] Переход в %BACKEND_DIR%
cd /d "%BACKEND_DIR%" || (
  echo [ERROR] Папка backend не найдена.
  pause
  exit /b 1
)

where py >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python Launcher ^(py^) не найден. Установите Python 3.11+.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [BACKEND] Создаю виртуальное окружение...
  py -m venv .venv
)

call ".venv\Scripts\activate.bat"

if not exist ".env" (
  echo [BACKEND] Файл .env не найден. Создаю шаблон...
  (
    echo MONGO_URL=mongodb://localhost:27017
    echo DB_NAME=ielts_center_master
    echo JWT_SECRET=change-me-very-strong-secret
  ) > ".env"
)

echo [BACKEND] Устанавливаю зависимости...
pip install -r requirements.txt >nul
pip install bcrypt==4.0.1 >nul

echo [BACKEND] Запуск API: http://localhost:8001
python -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload

echo [BACKEND] Процесс завершен.
pause
