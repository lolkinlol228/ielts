# Windows Runbook (быстрый запуск + решение проблем)

## Быстрый старт (рекомендуется)

1. Распакуйте проект в короткий путь, например: `C:\dev\ielts` (не Desktop).
2. Дважды кликните:
   - `windows\start_project.bat`

Скрипт автоматически откроет 2 окна:
- Backend: `http://localhost:8001`
- Frontend: `http://localhost:3000`

Для остановки:
- `windows\stop_project.bat`

---

## Что нужно установить один раз
- Python 3.11+
- Node.js LTS (18+)
- MongoDB Community Server (локально)

Проверка в PowerShell:
```powershell
python --version
node --version
npm --version
```

---

## Частые проблемы и решения

### 1) `yarn` не является командой
```powershell
npm install -g yarn
```

### 2) `uvicorn` не найден
Вы запускаете не из backend-venv.
```powershell
cd C:\dev\ielts\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload
```

### 3) MongoDB ошибка `WinError 10061` (localhost:27017)
MongoDB не запущен.

Вариант через Docker:
```powershell
docker run -d --name mongo-local -p 27017:27017 -v mongo_data:/data/db mongo:7
```

### 4) `passlib/bcrypt` ошибка на Windows
```powershell
cd C:\dev\ielts\backend
.\.venv\Scripts\Activate.ps1
pip uninstall -y bcrypt
pip install bcrypt==4.0.1
```

### 5) Vite ошибка `Access is denied` / `Could not resolve vite.config.js`
Обычно из-за запуска из `Desktop` и ограничений Windows.

Решение:
- Перенести проект в `C:\dev\ielts`
- Запускать оттуда.

### 6) Белая страница, но в терминале нет ошибок
Откройте браузерную консоль (F12) и проверьте import-ошибки. Часто проект неполно скопирован.

Проверьте наличие файлов:
- `frontend\vite.config.js`
- `frontend\src\main.jsx`
- `frontend\src\App.jsx`
- `frontend\src\contexts\AuthContext.jsx`

### 7) `Cannot find module ... vite.js`
Поврежден `node_modules`.
```powershell
cd C:\dev\ielts\frontend
Remove-Item -Recurse -Force node_modules
Remove-Item -Force yarn.lock
yarn cache clean
yarn install --production=false
```

---

## Ручной запуск без bat

### Backend
```powershell
cd C:\dev\ielts\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install bcrypt==4.0.1
python -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload
```

### Frontend
```powershell
cd C:\dev\ielts\frontend
yarn install --production=false
yarn start --host 127.0.0.1 --port 3000 --strictPort
```
