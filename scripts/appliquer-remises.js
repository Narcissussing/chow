// Reporte les remises immédiates de tickets/achats.csv (colonne remise) sur une base déjà importée :
// total payé, remise et prix au kg de chaque ligne concernée, puis total de chaque ticket.
// Rejouable : les remises déjà posées sont d'abord annulées (prix d'origine rétabli), puis toutes réappliquées,
// dans une seule transaction. Usage : node scripts/appliquer-remises.js (base de DATABASE_URL).
import "dotenv/config";
import fs from "fs";
import pg from "pg";

const nombre = (v) => (v === "" || v === undefined ? null : Number(v));
const lignes = fs.readFileSync("tickets/achats.csv", "utf8").trim().split("\n").slice(1).map((l) => l.split(";"))
    .filter((l) => Number(l[11]) > 0);

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
console.log("Base :", new URL(process.env.DATABASE_URL).hostname.split(".")[0]);
const client = await db.connect();
try {
    await client.query("BEGIN");
    await client.query("ALTER TABLE achats ADD COLUMN IF NOT EXISTS remise NUMERIC(10, 2) NOT NULL DEFAULT 0");
    // Remise à zéro : total d'avant remise et prix au kg recalculé.
    const annulees = await client.query(
        `UPDATE achats SET total = total + remise, remise = 0,
                prix_ref = CASE WHEN contenance IS NULL THEN prix_ref
                                ELSE round((total + remise) / (CASE WHEN poids IS NOT NULL THEN 1 ELSE COALESCE(quantite, 1) END * contenance), 2) END
         WHERE remise > 0 RETURNING ticket_id`
    );
    let faites = 0, introuvables = 0;
    const tickets = new Set(annulees.rows.map((r) => r.ticket_id));
    for (const [date, magasin, , libelle, , , , total, , , prixRef, remise] of lignes) {
        // La ligne d'origine : même ticket, même libellé, total d'avant remise, pas encore remisée.
        const r = await client.query(
            `UPDATE achats SET total = $4, remise = $5, prix_ref = COALESCE($6, prix_ref)
             WHERE id = (SELECT a.id FROM achats a JOIN tickets t ON t.id = a.ticket_id
                         WHERE t.date = $1 AND t.magasin = $2 AND a.libelle = $3 AND a.remise = 0
                           AND abs(a.total - ($4::numeric + $5::numeric)) < 0.01
                         ORDER BY a.id LIMIT 1)
             RETURNING ticket_id`,
            [date, magasin, libelle, Number(total), Number(remise), nombre(prixRef)]
        );
        if (r.rows.length) { faites++; tickets.add(r.rows[0].ticket_id); } else introuvables++;
    }
    await client.query(
        "UPDATE tickets SET total = s.total FROM (SELECT ticket_id, SUM(total) AS total FROM achats GROUP BY ticket_id) s WHERE s.ticket_id = tickets.id AND tickets.id = ANY($1)",
        [[...tickets]]
    );
    await client.query("COMMIT");
    console.log(`${faites} lignes remisées, ${introuvables} introuvables, ${tickets.size} tickets recalculés.`);
} catch (err) {
    await client.query("ROLLBACK");
    console.error("Annulé :", err.message);
    process.exitCode = 1;
} finally {
    client.release();
    await db.end();
}
