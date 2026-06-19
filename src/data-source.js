const METRIC_ALIASES = {
  "Города": "city",
  "Расходы": "spend",
  "Заявки": "leads",
  "Цена заявки": "cost_per_lead",
  "Не целевые": "bad_leads",
  "% не целевых": "bad_lead_rate",
  "Квалы": "qualified",
  "Цена квала": "cost_per_qualified",
  "Визиты": "visits",
  "% из квала в визит": "qualified_to_visit_rate",
  "Цена визита": "cost_per_visit",
  "Продажи в кредит": "credit_sales",
  "Цена продажи в кредит": "cost_per_credit_sale",
  "Цена продажи в кредит за вычетом налички": "cost_per_credit_sale_net_cash",
  "% из визита в продажу": "visit_to_sale_rate",
  "% из квала в продажу": "qualified_to_sale_rate",
  "Наличка": "cash_sales",
  "Обмен": "trade_in"
};

const VALID_CITIES = new Set([
  "Барнаул",
  "Кемерово",
  "Красноярск",
  "Новокузнецк",
  "Новосибирск",
  "Омск",
  "Оренбург",
  "Пермь",
  "Сургут",
  "Томск",
  "Тюмень",
  "Челябинск"
]);

const CHANNEL_LABELS = new Map([
  ["Все вместе", "Все источники"],
  ["Все источники вместе которые есть в данной таблице", "Все источники"],
  ["1. Директ", "Директ"],
  ["2. Пиксель", "Пиксель"],
  ["3. ГЦК", "ГЦК"],
  ["4. Карты", "Карты"],
  ["5. SEO", "SEO"],
  ["6. Прямой переход на сайт", "Прямой переход"],
  ["7. Звонки с сайтов", "Звонки с сайтов"],
  ["8. Прямые звонки с сайтов", "Прямые звонки"],
  ["9. Автокод", "Автокод"],
  ["10. Автоброкер", "Автоброкер"],
  ["11. Авито", "Авито"],
  ["12. Авто.ру", "Авто.ру"],
  ["13. Дром", "Дром"],
  ["14. SMM", "SMM"],
  ["15. Рекомендации", "Рекомендации"],
  ["16. Радио", "Радио"],
  ["17. ВК", "ВК"],
  ["18. МФО", "МФО"],
  ["19. Не определено", "Не определено"],
  ["20. Не заполнено", "Не заполнено"],
  ["Директ+Пексель", "Директ + Пиксель"]
]);

function extractSheetId(url) {
  const match = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : "";
}

function extractGid(url) {
  const match = String(url).match(/[?#&]gid=([0-9]+)/);
  return match ? match[1] : "";
}

function csvUrlFromSheet(config, sheetName) {
  const gid = config.gid || extractGid(config.googleSheetUrl);
  if (config.appsScriptProxyUrl && config.preferProxy) {
    const url = new URL(config.appsScriptProxyUrl);
    if (sheetName) url.searchParams.set("sheet", sheetName);
    if (gid) url.searchParams.set("gid", gid);
    return url.toString();
  }
  const id = extractSheetId(config.googleSheetUrl);
  if (!id) return "";
  const url = new URL(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq`);
  url.searchParams.set("tqx", "out:csv");
  if (sheetName) {
    url.searchParams.set("sheet", sheetName);
  } else if (gid) {
    url.searchParams.set("gid", gid);
  }
  return url.toString();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function normalizeAggregateRows(rows, channel = "Все источники", view = "fact") {
  if (!rows.length) return [];
  const headerIndexes = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row[0] === "Города" && row.includes("Расходы") && (row.includes("Заявки") || row.includes("Квалы")))
    .map(({ index }) => index);
  return headerIndexes.flatMap((headerIndex, blockIndex) => {
    const headers = rows[headerIndex];
    const title = nearestTitle(rows, headerIndex);
    const context = contextFromTitle(title, channel, view);
    const nextHeader = headerIndexes.find((index) => index > headerIndex) ?? rows.length;
    return rows.slice(headerIndex + 1, nextHeader).map((row) => {
      const item = {
        channel: context.channel,
        view: context.view,
        period: context.period,
        source_block: blockIndex + 1
      };
      headers.forEach((header, index) => {
        const key = METRIC_ALIASES[header];
        if (!key) return;
        item[key] = key === "city" ? row[index] : toNumber(row[index]);
      });
      return item;
    }).filter((item) => item.city && VALID_CITIES.has(item.city));
  });
}

function nearestTitle(rows, headerIndex) {
  for (let index = headerIndex - 1; index >= Math.max(0, headerIndex - 4); index -= 1) {
    const firstCell = rows[index]?.[0]?.trim();
    if (firstCell && !["Статистика по расходам", "Статистика из CRM"].includes(firstCell)) {
      return firstCell;
    }
  }
  return "";
}

function contextFromTitle(title, fallbackChannel, fallbackView) {
  const raw = title || "";
  const view = raw.includes("Дата инвестиций") ? "investment_date" : (raw.includes("Факт") ? "fact" : fallbackView);
  const period = (raw.match(/(2026[_ ].*)$/)?.[1] || "Google Sheets").replaceAll("_", " ");
  const rawChannel = raw
    .split(/_(?:Факт|Дата инвестиций)| Факт | Дата инвестиций/)[0]
    .replace(/^\d+\.\s*/, "")
    .trim();
  let channel = CHANNEL_LABELS.get(rawChannel) || rawChannel || fallbackChannel;
  if (channel.startsWith("Все источники вместе")) channel = "Все источники";
  if (channel === "Директ+Пексель") channel = "Директ + Пиксель";
  return { channel, view, period };
}

async function loadDashboardData() {
  const config = window.MRKTNG_CONFIG || {};
  if (!config.googleSheetUrl && !config.appsScriptProxyUrl) {
    return emptyDataset("Источник данных не настроен");
  }
  const sheet = config.sheetNames?.aggregate || "";
  const url = csvUrlFromSheet(config, sheet);
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csv = await response.text();
    const aggregate = normalizeAggregateRows(parseCsv(csv));
    if (!aggregate.length) throw new Error("No aggregate rows parsed");
    return {
      generatedFrom: config.googleSheetUrl || config.appsScriptProxyUrl,
      period: "Google Sheets live",
      grain: "city_channel_view",
      aggregate,
      daily: [],
      quality: [{ sheet, channel: "Все источники", view: "fact", rows: aggregate.length, blank_costs: aggregate.filter((row) => !row.spend).length }],
      source: "google"
    };
  } catch (error) {
    console.warn("Google Sheets load failed", error);
    return emptyDataset(humanizeSourceError(error));
  }
}

function humanizeSourceError(error) {
  if (error && error.message === "Failed to fetch") {
    return "закрытая Google-таблица не отдаёт данные напрямую. Подключите Apps Script-прокси в src/config.js";
  }
  return error && error.message ? error.message : "источник недоступен";
}

function emptyDataset(error = "") {
  return {
    generatedFrom: "",
    period: "",
    grain: "city_channel_view",
    aggregate: [],
    daily: [],
    quality: [],
    source: "blocked",
    error
  };
}

window.MRKTNG_DATA_SOURCE = { loadDashboardData };
