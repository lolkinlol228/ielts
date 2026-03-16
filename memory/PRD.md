# PRD — IELTS Center Platform (MVP v2 + UI/UX Redesign)

## 1) Оригинальный запрос пользователя
Построить серьёзный минималистичный и современный IELTS-сайт с публичной страницей (hero, о нас, программа, успехи, отзывы, заявка, футер), мультиязычностью RU/EN/KK, входом, админ-панелью и мультифилиалами.

### UI/UX Redesign v1 (2026-03-16)
Светлая тема, modern glassmorphism + строгий корпоративный стиль, синие оттенки, полный редизайн.

### UI/UX Fix v2 (2026-03-16)
- Убрать toast ошибки для публичных посетителей
- Добавить все соц.сети (Telegram, TikTok, YouTube, LinkedIn, Twitter)
- Хэдер — компактная одна строка (flex)
- Чекбокс "Инд. группа" — inline в строку с инпутами
- Улучшить расположение элементов

## 2) Архитектура
- **Стек**: FastAPI + MongoDB (Motor) + React (Vite)
- **Шрифты**: Plus Jakarta Sans (body), Outfit (headings), JetBrains Mono (code)
- **Дизайн**: CSS variables, glassmorphism (backdrop-filter blur), синяя корпоративная палитра

## 3) Что реализовано

### UI/UX Redesign (2026-03-16):
- Полная переработка index.css: glassmorphism, синяя палитра (#1e40af), generous spacing
- Gradient кнопки, smooth transitions, кастомные скроллбары
- Login: glassmorphism карточка + градиентный фон с radial blob-эффектами
- Hero: gradient overlay, новые hero-изображения
- Admin: glass sidebar, glow вкладки, организованные формы
- Модальные окна: backdrop blur + scale-in анимация

### UI/UX Fix v2 (2026-03-16):
- Убрали toast.error для public посетителей (branch/settings загрузка)
- Добавили 8 соц.сетей: Instagram, Facebook, WhatsApp, Telegram, TikTok, YouTube, LinkedIn, X (Twitter)
- Хэдер: flex header-row (brand | nav | socials | divider | phone | lang | cta) — всё в одну строку
- Группы: `.group-create-form` — flex inline row для prefix, number, year, checkbox, button
- Соц.сети динамические: пустые URL скрываются автоматически
- Admin Site Editor: все 8 соц.сетей редактируемы

## 4) Backlog

### P0
- Роль admin по филиалам
- Валидации форм

### P1
- Scroll animations (Intersection Observer)
- Dark mode toggle
- Анимированные счётчики метрик

### P2
- Экспорт CSV/PDF
- Уведомления студентам

## 5) Следующие шаги
1. Scroll-to-top кнопка + анимированные метрики
2. Филиальные админы
3. Dark mode toggle
