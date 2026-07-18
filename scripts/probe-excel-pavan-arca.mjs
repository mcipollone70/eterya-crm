/**
 * Search desktop Excel sources for PAVAN / ARCA / multibrand evidence.
 */
import xlsx from "xlsx";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const desktop = "C:/Users/Marco/Desktop";
const files = readdirSync(desktop).filter((f) => /\.(xlsx|xls|csv)$/i.test(f) && !f.startsWith("~$"));

function scanFile(path) {
  let wb;
  try {
    wb = xlsx.readFile(path);
  } catch (e) {
    return { path, error: e.message };
  }
  const hits = [];
  for (const sheetName of wb.SheetNames) {
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const text = JSON.stringify(row).toUpperCase();
      if (/PAVAN|ARCA GROUP|FERRAMENTA PAVAN/.test(text)) {
        hits.push({ sheet: sheetName, row: i + 1, data: row });
      }
    }
  }
  return { path, hits: hits.slice(0, 15), hitCount: hits.length };
}

for (const f of files) {
  const result = scanFile(join(desktop, f));
  if (result.error) {
    console.log("ERR", f, result.error);
    continue;
  }
  if (result.hitCount) {
    console.log("\n===", f, "hits", result.hitCount, "===");
    for (const h of result.hits.slice(0, 8)) {
      console.log(JSON.stringify(h, null, 2));
    }
  }
}
