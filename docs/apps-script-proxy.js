const SPREADSHEET_ID = "1Uk3ccDHEvq-zHk_vF02Af-grfwQ6-yrwaCXcQMdOXvA";

function doGet(event) {
  const params = event && event.parameter ? event.parameter : {};
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = resolveSheet(spreadsheet, params);
  const values = sheet.getDataRange().getDisplayValues();
  return ContentService
    .createTextOutput(toCsv(values))
    .setMimeType(ContentService.MimeType.CSV);
}

function resolveSheet(spreadsheet, params) {
  if (params.sheet) {
    const byName = spreadsheet.getSheetByName(params.sheet);
    if (byName) return byName;
  }
  if (params.gid) {
    const byGid = spreadsheet.getSheets().find((sheet) => String(sheet.getSheetId()) === String(params.gid));
    if (byGid) return byGid;
  }
  return spreadsheet.getSheets()[0];
}

function toCsv(rows) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
