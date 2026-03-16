@echo off
setlocal EnableExtensions EnableDelayedExpansion
title IELTS Center Frontend

set "ROOT_DIR=%~dp0.."
set "FRONTEND_DIR=%ROOT_DIR%\frontend"

echo [FRONTEND] Переход в %FRONTEND_DIR%
cd /d "%FRONTEND_DIR%" || (
  echo [ERROR] Папка frontend не найдена.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js не найден. Установите Node.js LTS.
  pause
  exit /b 1
)

where yarn >nul 2>nul
if errorlevel 1 (
  echo [FRONTEND] Yarn не найден. Пробую установить через npm...
  where npm >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] npm не найден. Установите Node.js LTS и повторите.
    pause
    exit /b 1
  )
  npm install -g yarn
)

if not exist "vite.config.js" (
  echo [ERROR] Не найден vite.config.js. Проверьте целостность проекта.
  pause
  exit /b 1
)

if not exist "src\main.jsx" (
  echo [ERROR] Не найден src\main.jsx. Проект поврежден или распакован не полностью.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [FRONTEND] Файл .env не найден. Создаю шаблон...
  (
    echo REACT_APP_BACKEND_URL=http://localhost:8001
  ) > ".env"
)

set "NODE_ENV=development"

echo [FRONTEND] Устанавливаю зависимости...
yarn install --production=false

echo [FRONTEND] Запуск UI: http://localhost:3000
yarn start --host 127.0.0.1 --port 3000 --strictPort

echo [FRONTEND] Процесс завершен.
pause
