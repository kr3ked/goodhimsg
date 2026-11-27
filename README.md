# Messenger на GitHub Pages + Supabase

Статический сайт (без сборки): `index.html`, `app.js`, `config.js`. Бэкенд — Supabase.

## 1. Supabase (бесплатно)
1. Создайте проект на https://supabase.com
2. SQL Editor → вставьте весь `supabase/schema.sql` → Run.
3. Authentication → Providers → Email → выключите **Confirm email** (иначе нужно подтверждать почту).
4. Project Settings → API → скопируйте **Project URL** и **anon public key** в `config.js`.

## 2. GitHub Pages
1. Создайте репозиторий и загрузите ВСЕ файлы из этой папки в корень (Add file → Upload files).
2. Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save.
3. Сайт откроется по адресу `https://<ваш-логин>.github.io/<репозиторий>/`.
4. Supabase → Authentication → URL Configuration → Site URL: этот адрес.

## Что работает
Регистрация/вход по email, профиль (имя, @username, био), поиск людей по @username, личные чаты в реальном времени, «печатает…», «в сети», галочки прочтения (✓ / ✓✓), счётчик непрочитанных, ответ/редактирование/удаление, светлая/тёмная/системная тема, звук, скрытие статуса «в сети», адаптив для телефона.
