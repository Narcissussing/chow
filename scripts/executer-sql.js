// Exécute un fichier SQL sur la base de DATABASE_URL. Usage : node scripts/executer-sql.js fichier.sql
import "dotenv/config"; import fs from "fs"; import pg from "pg";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
console.log("Base :", new URL(process.env.DATABASE_URL).hostname.split(".")[0]);
await db.connect();
try { const r = await db.query(fs.readFileSync(process.argv[2], "utf8")); console.log([r].flat().reduce((n, x) => n + (x.rowCount ?? 0), 0), "lignes"); } finally { await db.end(); }
