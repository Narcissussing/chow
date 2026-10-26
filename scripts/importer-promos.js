// Charge tickets/promos.csv (une ligne par remise immédiate) dans la table promos. Rejouable : la table est vidée
// puis rechargée dans une seule transaction. Usage : node scripts/importer-promos.js (base de DATABASE_URL).
import "dotenv/config";
import fs from "fs";
import pg from "pg";

const lignes = fs.readFileSync("tickets/promos.csv", "utf8").trim().split("\n").slice(1).map((l) => l.split(";"));
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
console.log("Base :", new URL(process.env.DATABASE_URL).hostname.split(".")[0]);
const client = await db.connect();
try {
    await client.query("BEGIN");
    await client.query(`
        CREATE TABLE IF NOT EXISTS promos (
            id SERIAL PRIMARY KEY, date DATE NOT NULL, magasin TEXT NOT NULL, produit TEXT NOT NULL,
            offre TEXT NOT NULL, type TEXT NOT NULL, pourcentage INTEGER, montant NUMERIC(10, 2) NOT NULL
        )`);
    await client.query("DELETE FROM promos");
    for (const [date, magasin, produit, offre, type, pourcentage, montant] of lignes) {
        await client.query(
            "INSERT INTO promos (date, magasin, produit, offre, type, pourcentage, montant) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [date, magasin, produit, offre, type, pourcentage === "" ? null : Number(pourcentage), Number(montant)]
        );
    }
    await client.query("COMMIT");
    console.log(`${lignes.length} promos chargées.`);
} catch (err) {
    await client.query("ROLLBACK");
    console.error("Annulé :", err.message);
    process.exitCode = 1;
} finally {
    client.release();
    await db.end();
}
