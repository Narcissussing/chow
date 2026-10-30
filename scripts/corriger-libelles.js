// Range des produits dans un autre article (fichier « LIBELLÉ;article » par ligne ; hors-chow et non-alimentaire
// vont dans les articles d'attente). Usage : node scripts/corriger-libelles.js fichier.txt (base de DATABASE_URL).
import "dotenv/config"; import fs from "fs"; import pg from "pg";
const ARTICLES_ATTENTE = { "hors-chow": "alimentation-a-detailler", "non-alimentaire": "non-alimentaire-a-classer" };
const lignes = fs.readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) => { const i = l.lastIndexOf(";"); return [l.slice(0, i), l.slice(i + 1)]; });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
console.log("Base :", new URL(process.env.DATABASE_URL).hostname.split(".")[0]);
const c = await db.connect(); let n = 0;
try { await c.query("BEGIN");
  for (const [libelle, article] of lignes)
    n += (await c.query("UPDATE achats.produits SET article_id = $2 WHERE libelle = $1", [libelle, ARTICLES_ATTENTE[article] ?? article])).rowCount;
  await c.query("COMMIT"); console.log(n, "produits mis à jour");
} catch (e) { await c.query("ROLLBACK"); console.error("annulé :", e.message); } finally { c.release(); await db.end(); }
