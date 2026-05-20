# GreatChess

Этот проект использует `@tanstack/react-start` и настроен как Cloudflare Worker/SSR-приложение.

## Почему Netlify не работает

Сайт сейчас публиковался на Netlify как статический SPA, но приложение на самом деле требует SSR/гидратацию из `@tanstack/react-start`.

Поэтому для публичного рабочего сайта нужно использовать Cloudflare Workers или Cloudflare Pages с `wrangler`.

## Быстрый запуск

1. Установите зависимости:

```bash
npm install
```

2. Авторизуйтесь в Cloudflare:

```bash
npm run cf:login
```

3. Опубликуйте сайт:

```bash
npm run cf:deploy
```

4. После успешного деплоя Cloudflare выдаст адрес, на котором сайт будет доступен.

## Полезные команды

- `npm run dev` — запуск локального Vite для разработки.
- `npm run build` — сборка проекта.
- `npm run cf:dev` — запуск локального Cloudflare Workers окружения.
- `npm run cf:deploy` — деплой на Cloudflare Workers.

## Автоматический деплой через GitHub Actions

Если вы хотите публиковать сайт автоматически при пуше в `main`, создайте в GitHub секреты:

- `CLOUDFLARE_API_TOKEN` — API токен Cloudflare с правами `Workers:Edit` и `Workers:Publish`.
- `CF_ACCOUNT_ID` — идентификатор аккаунта Cloudflare.

GitHub Actions файл уже добавлен в `.github/workflows/deploy-cloudflare.yml`.

## Примечание

Если хотите оставить Netlify, то проект надо переписать в обычный статический SPA без `@tanstack/react-start` и с `ReactDOM.createRoot`, потому что Netlify не может корректно запустить текущую SSR-архитектуру.
