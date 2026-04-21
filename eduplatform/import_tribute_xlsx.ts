import "dotenv/config";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { ensureTributeSchema, importXlsx } from "./src/tribute.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logger = {
  info: (obj: any, msg?: string) => console.log(msg || '', JSON.stringify(obj)),
  warn: (obj: any, msg?: string) => console.warn(msg || '', JSON.stringify(obj)),
  error: (obj: any, msg?: string) => console.error(msg || '', JSON.stringify(obj)),
};

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: tsx import_tribute_xlsx.ts <path-to-xlsx>');
    process.exit(1);
  }

  const dbPath = path.join(__dirname, 'data.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  ensureTributeSchema(db);
  const result = await importXlsx(db, filePath, logger);
  console.log('Import result:', result);
  db.close();
}

main().catch(e => { console.error(e); process.exit(1); });
