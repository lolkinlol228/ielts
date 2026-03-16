# IELTS Center — Fullstack Project

## Стек
- Backend: FastAPI + MongoDB
- Frontend: React (Vite)

## Self-host на Debian (ваш сервер + ваш домен)
- Полная инструкция: `SELF_HOSTING_DEBIAN.md`
- Готовые файлы деплоя: `deploy/docker-compose.yml` и `deploy/.env.example`

## Windows (автозапуск bat + troubleshooting)
- Полная инструкция: `WINDOWS_RUNBOOK.md`
- Автозапуск: `windows/start_project.bat`
- Отдельно backend: `windows/start_backend.bat`
- Отдельно frontend: `windows/start_frontend.bat`
- Остановка: `windows/stop_project.bat`

---

## Быстрый запуск на Windows

### 1) Что установить
- **Python 3.11+**
- **Node.js 18+** (рекомендуется LTS)
- **Yarn** (`npm i -g yarn`)
- **MongoDB Community Server**

Проверьте версии в PowerShell:
```powershell
python --version
node --version
yarn --version
```

---

### 2) Клонировать/распаковать проект
```powershell
cd C:\projects
git clone <your_repo_url> ielts-center
cd ielts-center
```

Если у вас ZIP — просто распакуйте папку и перейдите в неё.

---

### 3) Настроить backend

Перейдите в backend:
```powershell
cd backend
```

Создайте/проверьте файл `.env`:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=ielts_center_master
JWT_SECRET=change-me-super-secret
```

Создайте виртуальное окружение и установите зависимости:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Запуск backend:
```powershell
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

---

### 4) Настроить frontend

Откройте **новый** терминал PowerShell:
```powershell
cd C:\projects\ielts-center\frontend
```

Создайте/проверьте `.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

Установите зависимости и запустите фронт:
```powershell
yarn install
yarn start
```

Откройте:
- Frontend: `http://localhost:3000`
- Backend docs: `http://localhost:8001/docs`

---

## Частые проблемы на Windows

### MongoDB не подключается
- Проверьте, что служба MongoDB запущена.
- Проверьте `MONGO_URL` в `backend/.env`.

### CORS / API ошибки
- Проверьте, что `REACT_APP_BACKEND_URL=http://localhost:8001`.
- Перезапустите frontend после изменения `.env`.

### Не запускается `yarn`
- Установите Yarn глобально:
```powershell
npm i -g yarn
```

