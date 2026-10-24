// Applique des corrections d'association libellé → aliment (fichier « LIBELLÉ;aliment » par ligne, statut si hors-chow,
// non-alimentaire ou non-detaille). Usage : node scripts/corriger-libelles.js fichier.txt (base de DATABASE_URL).
import "dotenv/config"; import fs from "fs"; import pg from "pg";
const STATUTS = ["hors-chow", "non-alimentaire", "non-detaille"];
const lignes = fs.readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) => { const i = l.lastIndexOf(";"); return [l.slice(0, i), l.slice(i + 1)]; });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
console.log("Base :", new URL(process.env.DATABASE_URL).hostname.split(".")[0]);
const c = await db.connect(); let n = 0;
try { await c.query("BEGIN");
  for (const [libelle, aliment] of lignes) { const statut = STATUTS.includes(aliment) ? aliment : "chow";
    n += (await c.query("UPDATE libelles SET food_id = $2, statut = $3 WHERE libelle = $1", [libelle, statut === "chow" ? aliment : null, statut])).rowCount; }
  await c.query("COMMIT"); console.log(n, "libellés mis à jour");
} catch (e) { await c.query("ROLLBACK"); console.error("annulé :", e.message); } finally { c.release(); await db.end(); }
