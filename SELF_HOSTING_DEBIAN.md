# Развертывание на своём Debian сервере (под ваш домен)

Ниже полностью локальный вариант: **MongoDB, backend, frontend на вашем сервере**.

## 1) Требования
- Debian 12+
- Docker + Docker Compose plugin
- Домен, указывающий A-запись на IP сервера

## 2) Установка Docker
```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 3) Подготовка проекта
```bash
git clone <ВАШ_REPO_URL> ielts-center
cd ielts-center/deploy
cp .env.example .env
```

Откройте `.env` и задайте:
- `JWT_SECRET` — длинный случайный секрет
- `DB_NAME` — имя БД (можно оставить по умолчанию)

## 4) Запуск
```bash
docker compose up -d --build
docker compose ps
```

После запуска сайт доступен на порту 80:
- `http://ВАШ_ДОМЕН`

## 5) Проверка
```bash
curl -s http://localhost/api/health
```
Ожидаемо: `{"status":"ok"}`

## 6) Обновление после изменений
```bash
git pull
cd deploy
docker compose up -d --build
```

## 7) Резервные копии MongoDB
```bash
docker exec -it ielts-mongodb mongodump --archive=/tmp/backup.archive
docker cp ielts-mongodb:/tmp/backup.archive ./backup.archive
```

## 8) HTTPS (рекомендуется)
Самый простой путь: поставить Nginx/Caddy как внешний reverse-proxy и выпустить Let's Encrypt сертификат.
Если хотите, подготовлю готовый `Caddyfile` или `nginx` конфиг под ваш домен.
