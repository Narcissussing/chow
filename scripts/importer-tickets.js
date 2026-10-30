// Import des tickets de caisse depuis tickets/achats.csv, tickets/correspondances.csv et tickets/promos.csv.
// Usage : node scripts/importer-tickets.js (utilise DATABASE_URL du .env). Rejouable : n'ajoute que les tickets absents.
import "dotenv/config";
import fs from "fs";
import pg from "pg";

const lire = (fichier) =>
    fs.readFileSync(fichier, "utf8").trim().split("\n").slice(1).map((ligne) => ligne.split(";"));
const nombre = (valeur) => (valeur === undefined || valeur === "" ? null : Number(valeur));
const PASSAGE_BANCAIRE = "PASSAGE NON DÉTAILLÉ (relevé bancaire)";
// Statuts de correspondances.csv sans aliment Chow : rangés dans un article d'attente jusqu'au catalogue.
const ARTICLES_ATTENTE = { "hors-chow": "alimentation-a-detailler", "non-alimentaire": "non-alimentaire-a-classer" };

const achats = lire("tickets/achats.csv");
const articleDuLibelle = new Map(lire("tickets/correspondances.csv").map(([libelle, aliment]) => [libelle, aliment]));
const promos = lire("tickets/promos.csv");

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
console.log("Base :", new URL(process.env.DATABASE_URL).hostname.split(".")[0]);

// Format d'une unité vendue : au poids, contenance lue sur le libellé, sinon une pièce (boîte d'œufs : nombre imprimé).
function format(ligne, articleId) {
    const [, , , libelle, , poids, , , contenance, unite] = ligne;
    if (poids) return { contenance: null, unite: "kg" };
    if (contenance) return { contenance: Number(contenance), unite };
    const oeufs = articleId?.startsWith("oeuf") && (libelle.match(/(\d+)\s*P\b/) || libelle.match(/X\s*(\d+)\b/));
    return { contenance: oeufs ? Number(oeufs[1]) : 1, unite: "piece" };
}

const client = await db.connect();
try {
    await client.query("BEGIN");
    const magasins = new Map((await client.query("SELECT id, nom, enseigne_id FROM achats.magasins")).rows.map((m) => [m.nom, m]));
    const articles = new Set((await client.query("SELECT id FROM achats.articles")).rows.map((a) => a.id));
    let nouveauxTickets = 0, nouvellesLignes = 0, nouveauxProduits = 0, nouvellesPromos = 0;
    const aClasser = new Set();

    const tickets = new Map();
    for (const ligne of achats) {
        const cle = ligne[0] + "|" + ligne[1];
        if (!tickets.has(cle)) tickets.set(cle, []);
        tickets.get(cle).push(ligne);
    }

    for (const lignes of tickets.values()) {
        const [date, nomMagasin] = lignes[0];
        const magasin = magasins.get(nomMagasin);
        if (!magasin) throw new Error(`Magasin inconnu : ${nomMagasin} (l'ajouter dans achats.magasins)`);
        const code = `${date}-${magasin.id}`;
        if ((await client.query("SELECT 1 FROM achats.tickets WHERE code = $1", [code])).rowCount) continue;

        const bancaire = lignes.every((l) => l[3] === PASSAGE_BANCAIRE);
        const paye = lignes.reduce((s, l) => s + Number(l[7]), 0);
        const montantAvantRemise = lignes.reduce((s, l) => s + Number(l[7]) + (nombre(l[11]) ?? 0), 0);
        const ticket = await client.query(
            `INSERT INTO achats.tickets (code, magasin_id, date, source, total_articles, paye)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [code, magasin.id, date,
                bancaire ? "releve-bancaire" : magasin.enseigne_id === "marche-frais" ? "ticket-papier" : "ticket-numerique",
                bancaire ? null : montantAvantRemise.toFixed(2), paye.toFixed(2)]
        );
        nouveauxTickets++;
        if (bancaire) continue;

        const promosDuTicket = promos.filter((p) => p[0] === date && p[1] === nomMagasin);
        for (const ligne of lignes) {
            const [, , rayon, libelle, quantite, poids, prixUnitaire, total, , , , remise] = ligne;
            const correspondance = articleDuLibelle.get(libelle) ?? "";
            let articleId = ARTICLES_ATTENTE[correspondance] ?? (correspondance || null);
            if (articleId && !articles.has(articleId)) articleId = null;
            if (!articleId) aClasser.add(libelle);
            let { contenance, unite } = format(ligne, articleId);
            // Hors alimentation, un paquet vendu à la pièce compte ses unités (14P, X35, 12 RLX).
            if (unite === "piece" && contenance === 1 && articleId) {
                const paquet = await client.query(
                    `SELECT achats.nombre_par_paquet($1) AS n FROM achats.articles a JOIN achats.categories c ON c.id = a.categorie_id
                     WHERE a.id = $2 AND COALESCE(c.parent_id, c.id) NOT IN ('alimentation', 'boissons')`, [libelle, articleId]);
                contenance = Number(paquet.rows[0]?.n ?? 1);
            }
            const produit = await client.query(
                `INSERT INTO achats.produits (enseigne_id, libelle, article_id, contenance, unite) VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (enseigne_id, libelle) DO NOTHING RETURNING id`,
                [magasin.enseigne_id, libelle, articleId, contenance, unite]
            );
            nouveauxProduits += produit.rowCount;
            const produitId = produit.rows[0]?.id
                ?? (await client.query("SELECT id FROM achats.produits WHERE enseigne_id = $1 AND libelle = $2", [magasin.enseigne_id, libelle])).rows[0].id;
            const ligneAjoutee = await client.query(
                `INSERT INTO achats.lignes (ticket_id, produit_id, rayon, quantite, unite_vente, prix_unitaire, montant)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [ticket.rows[0].id, produitId, rayon || null, nombre(poids) ?? nombre(quantite) ?? 1, poids ? "kg" : "piece",
                    nombre(prixUnitaire), (Number(total) + (nombre(remise) ?? 0)).toFixed(2)]
            );
            nouvellesLignes++;
            // Remises de cette ligne, dans l'ordre de promos.csv.
            if (nombre(remise) > 0) {
                const i = promosDuTicket.findIndex((p) => p[2] === libelle);
                if (i < 0) throw new Error(`Remise sans promo dans promos.csv : ${date} ${nomMagasin} ${libelle}`);
                const [, , , offre, type, pourcentage, montant] = promosDuTicket.splice(i, 1)[0];
                await client.query(
                    "INSERT INTO achats.promos (ligne_id, offre, type, pourcentage, montant) VALUES ($1, $2, $3, $4, $5)",
                    [ligneAjoutee.rows[0].id, offre, type, nombre(pourcentage), montant]
                );
                nouvellesPromos++;
            }
        }
    }

    await client.query("COMMIT");
    console.log(`${nouveauxTickets} tickets, ${nouvellesLignes} lignes, ${nouveauxProduits} produits, ${nouvellesPromos} promos ajoutés.`);
    if (aClasser.size) console.log(`À classer (sans article) : ${[...aClasser].join(" · ")}`);
} catch (err) {
    await client.query("ROLLBACK");
    console.error("Import annulé :", err.message);
    process.exitCode = 1;
} finally {
    client.release();
    await db.end();
}
