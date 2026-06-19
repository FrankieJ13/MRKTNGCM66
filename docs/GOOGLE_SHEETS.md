# Google Sheets подключение

Ссылка на рабочую таблицу уже прописана в `src/config.js`:

`https://docs.google.com/spreadsheets/d/1Uk3ccDHEvq-zHk_vF02Af-grfwQ6-yrwaCXcQMdOXvA/edit?gid=1401660608#gid=1401660608`

## Почему нужен прокси

Закрытая Google-таблица обычно не отдаёт CSV напрямую в браузер дашборда из-за CORS и авторизации. Проверка Pages показывает `Failed to fetch`, поэтому для боевого режима нужен Apps Script-прокси.

## Важно про приватность

Если Web App развернуть как `Execute as: Me` и открыть доступ `Anyone`, то данные таблицы фактически станут доступны всем посетителям дашборда через URL прокси.

Чтобы сохранить смысл “видят только те, у кого есть доступ”, разворачивайте прокси так, чтобы Google требовал вход пользователя и проверял его доступ к таблице:

- Execute as: `User accessing the web app`, если доступно в вашем аккаунте.
- Who has access: `Anyone with Google account` или ограниченный домен/группа.
- Таблица должна быть расшарена тем пользователям, которые должны видеть дашборд.

Если нужен публичный дашборд без логина, тогда это уже не приватная таблица: прокси должен работать от владельца и будет отдавать данные всем, кто открыл Pages.

## Как развернуть

1. Откройте [Google Apps Script](https://script.google.com/).
2. Создайте новый проект.
3. Вставьте код из `docs/apps-script-proxy.js`.
4. Нажмите `Deploy` → `New deployment`.
5. Тип: `Web app`.
6. Execute as: `User accessing the web app`, если хотите сохранить доступ только для пользователей с правами на таблицу.
7. Who has access: выберите `Anyone with Google account` или ограничьте доступ доменом/группой.
8. Скопируйте Web app URL.
9. Вставьте его в `src/config.js`:

```js
window.MRKTNG_CONFIG = {
  googleSheetUrl: "https://docs.google.com/spreadsheets/d/1Uk3ccDHEvq-zHk_vF02Af-grfwQ6-yrwaCXcQMdOXvA/edit?gid=1401660608#gid=1401660608",
  gid: "1401660608",
  sheetNames: {
    aggregate: "Все вместе_Факт"
  },
  appsScriptProxyUrl: "PASTE_WEB_APP_URL_HERE",
  preferProxy: true
};
```

Прокси принимает параметры `sheet` и `gid`, поэтому дашборд сможет обращаться к конкретной вкладке таблицы.
