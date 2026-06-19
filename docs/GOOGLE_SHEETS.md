# Google Sheets подключение

Ссылка на рабочую таблицу уже прописана в `src/config.js`:

`https://docs.google.com/spreadsheets/d/1Uk3ccDHEvq-zHk_vF02Af-grfwQ6-yrwaCXcQMdOXvA/edit?gid=1401660608#gid=1401660608`

## Почему нужен прокси

Закрытая Google-таблица обычно не отдаёт CSV напрямую в браузер дашборда из-за CORS и авторизации. Локальная проверка показала `Failed to fetch`, поэтому для боевого режима нужен Apps Script-прокси, запущенный от Google-аккаунта, у которого есть доступ к таблице.

## Как развернуть

1. Откройте [Google Apps Script](https://script.google.com/).
2. Создайте новый проект.
3. Вставьте код из `docs/apps-script-proxy.js`.
4. Нажмите `Deploy` → `New deployment`.
5. Тип: `Web app`.
6. Execute as: `Me`.
7. Who has access: выберите режим доступа для пользователей дашборда.
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
