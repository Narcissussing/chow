// Import des tickets de caisse depuis tickets/achats.csv et tickets/correspondances.csv.
// Usage : node scripts/importer-tickets.js (utilise DATABASE_URL du .env). Rejouable : n'ajoute que les tickets et libellés absents.
import "dotenv/config";
import fs from "fs";
import pg from "pg";

const lire = (fichier) =>
    fs.readFileSync(fichier, "utf8").trim().split("\n").slice(1).map((ligne) => ligne.split(";"));
const nombre = (valeur) => (valeur === "" ? null : Number(valeur));
const STATUTS = ["hors-chow", "non-alimentaire", "non-detaille"];

const achats = lire("tickets/achats.csv");
const correspondances = lire("tickets/correspondances.csv");

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const hote = new URL(process.env.DATABASE_URL).hostname.split(".")[0];
console.log("Base :", hote);

const client = await db.connect();
try {
    await client.query("BEGIN");
    let nouveauxLibelles = 0, nouveauxTickets = 0, nouveauxAchats = 0;

    for (const [libelle, aliment] of correspondances) {
        const statut = aliment === "" ? "a-classer" : STATUTS.includes(aliment) ? aliment : "chow";
        nouveauxLibelles += (await client.query("INSERT INTO libelles (libelle, food_id, statut) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [
            libelle,
            statut === "chow" ? aliment : null,
            statut,
        ])).rowCount;
    }

    // Pas d'identifiant de ticket dans le CSV : un passage en caisse = une date dans un magasin.
    const tickets = new Map();
    for (const ligne of achats) {
        const cle = ligne[0] + "|" + ligne[1];
        if (!tickets.has(cle)) tickets.set(cle, []);
        tickets.get(cle).push(ligne);
    }

    for (const lignes of tickets.values()) {
        const [date, magasin] = lignes[0];
        const dejaLa = await client.query("SELECT 1 FROM tickets WHERE date IS NOT DISTINCT FROM $1 AND magasin = $2",
            [date.includes("?") ? null : date, magasin]);
        if (dejaLa.rowCount) continue;
        nouveauxTickets++;
        nouveauxAchats += lignes.length;
        const total = lignes.reduce((somme, l) => somme + Number(l[7]), 0);
        const ticket = await client.query(
            "INSERT INTO tickets (date, magasin, enseigne, total) VALUES ($1, $2, $3, $4) RETURNING id",
            // Ticket Marché Frais 466182 photographié sans sa date : importé sans date plutôt qu'avec une date inventée.
            [date.includes("?") ? null : date, magasin,magasin.split(" ")[0].replace("Marché", "Marché Frais"), total.toFixed(2)]
        );
        for (const [, , rayon, libelle, quantite, poids, prixUnitaire, totalLigne, contenance, unite, prixRef, remise] of lignes) {
            await client.query(
                `INSERT INTO achats (ticket_id, rayon, libelle, quantite, poids, prix_unitaire, total, contenance, unite, prix_ref, remise)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [ticket.rows[0].id, rayon || null, libelle, nombre(quantite), nombre(poids), nombre(prixUnitaire),
                    Number(totalLigne), nombre(contenance), unite || null, nombre(prixRef), nombre(remise ?? "") ?? 0]
            );
        }
    }

    await client.query("COMMIT");
    console.log(`${nouveauxLibelles} libellés, ${nouveauxTickets} tickets, ${nouveauxAchats} achats ajoutés.`);
} catch (err) {
    await client.query("ROLLBACK");
    console.error("Import annulé :", err.message);
    process.exitCode = 1;
} finally {
    client.release();
    await db.end();
}
