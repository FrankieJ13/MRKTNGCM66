const state = {
  data: null,
  period: "2026 Май-Июнь с 1 по 14",
  view: "fact",
  channel: "Все источники",
  city: "Все города",
  dailyMetric: "leads"
};

const labels = {
  fact: "Факт",
  investment_date: "Дата инвестиций",
  leads: "Заявки",
  qualified: "Квалы",
  visits: "Визиты",
  credit_sales: "Продажи"
};

const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 1 });

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function weighted(rows, numerator, denominator) {
  const den = sum(rows, denominator);
  return den ? sum(rows, numerator) / den : 0;
}

function formatMoney(value) {
  return `${money.format(value || 0)} ₽`;
}

function optionList(select, values, selected) {
  select.innerHTML = values.map((value) => `<option ${value === selected ? "selected" : ""}>${value}</option>`).join("");
}

function shortPeriod(period) {
  return period
    .replace("2026 ", "")
    .replace("с 1 по 14", "1-14")
    .replace("Май-Июнь", "Май + Июнь");
}

function filteredRows() {
  return state.data.aggregate.filter((row) => (
    (state.period === "Все периоды" || row.period === state.period) &&
    row.view === state.view &&
    (state.channel === "Все каналы" || row.channel === state.channel) &&
    (state.city === "Все города" || row.city === state.city)
  ));
}

function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "Не заполнено";
    acc[value] = acc[value] || [];
    acc[value].push(row);
    return acc;
  }, {});
}

function renderKpis(rows) {
  if (!state.data.aggregate.length) {
    document.querySelector("#kpiGrid").innerHTML = `
      <article class="empty-state">
        <strong>Нет доступа к данным</strong>
        <span>Дашборд не хранит данные в репозитории. Для просмотра закрытой таблицы нужен Apps Script-прокси, развёрнутый от аккаунта с доступом к Google Sheets.</span>
      </article>
    `;
    return;
  }
  const spend = sum(rows, "spend");
  const leads = sum(rows, "leads");
  const qualified = sum(rows, "qualified");
  const visits = sum(rows, "visits");
  const sales = sum(rows, "credit_sales");
  const kpis = [
    ["Расходы", formatMoney(spend), "маркетинговый бюджет"],
    ["Заявки", number.format(leads), `CPL ${formatMoney(leads ? spend / leads : 0)}`],
    ["Квалы", number.format(qualified), `конверсия ${percent.format(weighted(rows, "qualified", "leads"))}`],
    ["Визиты", number.format(visits), `из квала ${percent.format(weighted(rows, "visits", "qualified"))}`],
    ["Продажи в кредит", number.format(sales), `из визита ${percent.format(weighted(rows, "credit_sales", "visits"))}`],
    ["Цена продажи", formatMoney(sales ? spend / sales : 0), "по кредитным продажам"]
  ];
  document.querySelector("#kpiGrid").innerHTML = kpis.map(([title, value, note]) => `
    <article class="kpi-card">
      <span>${title}</span>
      <strong>${value}</strong>
      <small>${note}</small>
    </article>
  `).join("");
}

function renderFunnel(rows) {
  if (!rows.length) {
    document.querySelector("#funnelChart").innerHTML = `<div class="panel-empty">Нет данных для выбранных фильтров</div>`;
    document.querySelector("#funnelRate").textContent = "Нет данных";
    return;
  }
  const stages = [
    ["Заявки", sum(rows, "leads")],
    ["Квалы", sum(rows, "qualified")],
    ["Визиты", sum(rows, "visits")],
    ["Продажи", sum(rows, "credit_sales")]
  ];
  const max = Math.max(...stages.map(([, value]) => value), 1);
  document.querySelector("#funnelChart").innerHTML = stages.map(([name, value], index) => {
    const width = Math.max(8, value / max * 100);
    const prev = index ? stages[index - 1][1] : value;
    const rate = prev ? value / prev : 0;
    return `
      <div class="funnel-row">
        <div class="funnel-label"><b>${name}</b><span>${number.format(value)}</span></div>
        <div class="funnel-track"><span style="width:${width}%"></span></div>
        <em>${index ? percent.format(rate) : "100%"}</em>
      </div>
    `;
  }).join("");
  const leadToSale = stages[0][1] ? stages[3][1] / stages[0][1] : 0;
  document.querySelector("#funnelRate").textContent = `Lead → sale ${percent.format(leadToSale)}`;
}

function renderBars(selector, rows, key, metric, limit) {
  if (!rows.length) {
    document.querySelector(selector).innerHTML = `<div class="panel-empty">Нет данных</div>`;
    return;
  }
  const groups = Object.entries(groupBy(rows, key)).map(([name, items]) => ({
    name,
    spend: sum(items, "spend"),
    leads: sum(items, "leads"),
    sales: sum(items, "credit_sales"),
    value: sum(items, metric)
  })).sort((a, b) => b.value - a.value).slice(0, limit);
  const max = Math.max(...groups.map((item) => item.value), 1);
  document.querySelector(selector).innerHTML = groups.map((item) => `
    <div class="bar-row">
      <div class="bar-copy">
        <b>${item.name}</b>
        <span>${formatMoney(item.spend)} · ${number.format(item.leads)} заявок · ${number.format(item.sales)} продаж</span>
      </div>
      <div class="bar-track"><span style="width:${Math.max(2, item.value / max * 100)}%"></span></div>
    </div>
  `).join("");
}

function renderTrend() {
  const svg = document.querySelector("#trendChart");
  if (!state.data.daily.length) {
    svg.innerHTML = `<text x="24" y="80" class="empty-chart">Дневной ряд не загружен</text>`;
    return;
  }
  const metric = state.dailyMetric;
  const city = state.city === "Все города" ? "Красноярск" : state.city;
  const rows = state.data.daily.filter((row) => row.city === city && row.metric === metric).slice(-45);
  if (!rows.length) {
    svg.innerHTML = `<text x="24" y="80" class="empty-chart">Нет дневного ряда для выбранного города</text>`;
    return;
  }
  const width = 760;
  const height = 240;
  const pad = 30;
  const max = Math.max(...rows.map((row) => row.value), 1);
  const points = rows.map((row, index) => {
    const x = pad + index * ((width - pad * 2) / Math.max(1, rows.length - 1));
    const y = height - pad - (row.value / max) * (height - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const last = rows[rows.length - 1];
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <line x1="${pad}" x2="${width - pad}" y1="${height - pad}" y2="${height - pad}" class="axis"></line>
    <line x1="${pad}" x2="${pad}" y1="${pad}" y2="${height - pad}" class="axis"></line>
    <polyline points="${points}" class="trend-line"></polyline>
    ${rows.map((row, index) => {
      const [x, y] = points.split(" ")[index].split(",");
      return `<circle cx="${x}" cy="${y}" r="3" class="trend-dot"><title>${row.date}: ${row.value}</title></circle>`;
    }).join("")}
    <text x="${width - pad - 130}" y="${pad + 8}" class="trend-label">${labels[metric]}: ${number.format(last.value)}</text>
  `;
}

function renderQuality() {
  const rows = state.data.quality.slice(0, 8);
  if (!rows.length) {
    document.querySelector("#qualityTable").innerHTML = `<div class="panel-empty">Источник недоступен или ещё не настроен</div>`;
    return;
  }
  document.querySelector("#qualityTable").innerHTML = rows.map((row) => `
    <div class="quality-row">
      <b>${row.sheet}</b>
      <span>${row.period || "период не определён"} · строк: ${row.rows} · шапка: ${row.header_row || "n/a"} · пустые расходы: ${row.blank_costs}</span>
    </div>
  `).join("");
}

function renderDailyButtons() {
  const metrics = ["leads", "qualified", "visits", "credit_sales"];
  document.querySelector("#dailyMetric").innerHTML = metrics.map((metric) => `
    <button type="button" data-metric="${metric}" class="${state.dailyMetric === metric ? "active" : ""}">${labels[metric]}</button>
  `).join("");
}

function renderPeriodButtons() {
  const periods = ["Все периоды", ...new Set(state.data.aggregate.map((row) => row.period).filter(Boolean))];
  document.querySelector("#activePeriodLabel").textContent = state.period;
  document.querySelector("#periodChips").innerHTML = periods.map((period) => `
    <button type="button" data-period="${period}" aria-label="Период: ${period}" class="${state.period === period ? "active" : ""}">${shortPeriod(period)}</button>
  `).join("");
}

function render() {
  const rows = filteredRows();
  const channelRows = state.channel === "Все источники"
    ? state.data.aggregate.filter((row) => (
      (state.period === "Все периоды" || row.period === state.period) &&
      row.view === state.view &&
      row.channel !== "Все источники" &&
      (state.city === "Все города" || row.city === state.city)
    ))
    : rows;
  renderKpis(rows);
  renderFunnel(rows);
  renderBars("#channelChart", channelRows, "channel", "spend", 9);
  renderBars("#cityChart", rows, "city", "spend", 10);
  renderPeriodButtons();
  renderDailyButtons();
  renderTrend();
  renderQuality();
}

function bindControls() {
  document.querySelector("#periodChips").addEventListener("click", (event) => {
    const period = event.target.dataset.period;
    if (!period) return;
    state.period = period;
    render();
  });
  document.querySelector("#viewFilter").addEventListener("change", (event) => {
    state.view = event.target.value;
    render();
  });
  document.querySelector("#channelFilter").addEventListener("change", (event) => {
    state.channel = event.target.value;
    render();
  });
  document.querySelector("#cityFilter").addEventListener("change", (event) => {
    state.city = event.target.value;
    render();
  });
  document.querySelector("#resetFilters").addEventListener("click", () => {
    state.period = "2026 Май-Июнь с 1 по 14";
    state.view = "fact";
    state.channel = "Все источники";
    state.city = "Все города";
    initFilters();
    render();
  });
  document.querySelector("#dailyMetric").addEventListener("click", (event) => {
    if (!event.target.dataset.metric) return;
    state.dailyMetric = event.target.dataset.metric;
    render();
  });
}

function initFilters() {
  const rows = state.data.aggregate;
  const periods = [...new Set(rows.map((row) => row.period).filter(Boolean))];
  if (!periods.includes(state.period)) state.period = periods[0] || "Все периоды";
  optionList(document.querySelector("#viewFilter"), [...new Set(rows.map((row) => row.view))], state.view);
  optionList(document.querySelector("#channelFilter"), ["Все каналы", ...new Set(rows.map((row) => row.channel)).values()], state.channel);
  optionList(document.querySelector("#cityFilter"), ["Все города", ...new Set(rows.map((row) => row.city)).values()], state.city);
}

async function start() {
  state.data = await window.MRKTNG_DATA_SOURCE.loadDashboardData();
  const status = document.querySelector("#sourceStatus");
  if (state.data.source === "google") status.textContent = "Источник: Google Sheets";
  if (state.data.source === "blocked") status.textContent = `Источник недоступен${state.data.error ? `: ${state.data.error}` : ""}`;
  initFilters();
  bindControls();
  render();
}

start();
