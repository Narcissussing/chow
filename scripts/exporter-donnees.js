// Export de la base Family Hub : un CSV par table et par vue, README.md tiré des COMMENT, et un pg_dump complet.
// Usage : node scripts/exporter-donnees.js [dossier] (par défaut ~/Perso/House Projects/family-hub-data).
import "dotenv/config";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import pg from "pg";

const DOSSIER = process.argv[2] || path.join(os.homedir(), "Perso", "House Projects", "family-hub-data");
const SCHEMAS = ["famille", "achats", "chow", "reference"];
// Jamais exportés : empreintes de mot de passe et photos (binaire).
const COLONNES_EXCLUES = { "famille.comptes": ["mot_de_passe"], "chow.courses": ["photo"] };
// Tables et vues qui grossissent : un fichier par année, selon la date du ticket.
const PAR_ANNEE = {
    "achats.lignes": "SELECT x.* FROM achats.lignes x JOIN achats.tickets t ON t.id = x.ticket_id WHERE extract(year FROM t.date) = $1 ORDER BY x.id",
    "achats.promos": "SELECT x.* FROM achats.promos x JOIN achats.lignes l ON l.id = x.ligne_id JOIN achats.tickets t ON t.id = l.ticket_id WHERE extract(year FROM t.date) = $1 ORDER BY x.id",
    "achats.v_lignes": "SELECT * FROM achats.v_lignes WHERE extract(year FROM date) = $1 ORDER BY ligne_id",
};
const SAUVEGARDES_GARDEES = 12;

// Valeurs telles que PostgreSQL les écrit (dates ISO, nombres exacts), booléens en true / false.
const BOOLEEN = 16;
const db = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    types: { getTypeParser: (oid) => (oid === BOOLEEN ? (v) => (v === "t" ? "true" : "false") : (v) => v) },
});
const base = new URL(process.env.DATABASE_URL).hostname.split(".")[0];
console.log("Base :", base, "→", DOSSIER);

const champ = (v) => (v === null ? "" : /[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
function ecrireCsv(fichier, colonnes, lignes) {
    fs.mkdirSync(path.dirname(fichier), { recursive: true });
    fs.writeFileSync(fichier, [colonnes.join(","), ...lignes.map((l) => colonnes.map((c) => champ(l[c])).join(","))].join("\n") + "\n");
}

await db.connect();
try {
    const objets = (await db.query(
        `SELECT n.nspname AS schema, c.relname AS nom, c.relkind AS type, obj_description(c.oid) AS description, c.oid
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = ANY($1) AND c.relkind IN ('r', 'v')
         ORDER BY array_position($1, n.nspname::text), c.relkind, c.relname`, [SCHEMAS])).rows;
    const annees = (await db.query("SELECT DISTINCT extract(year FROM date)::int::text AS a FROM achats.tickets ORDER BY 1")).rows.map((r) => r.a);
    const dictionnaire = [];

    for (const o of objets) {
        const nomComplet = `${o.schema}.${o.nom}`;
        const colonnes = (await db.query(
            `SELECT a.attname AS nom, format_type(a.atttypid, a.atttypmod) AS type, col_description(a.attrelid, a.attnum) AS description
             FROM pg_attribute a WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`, [o.oid])).rows
            .filter((c) => !(COLONNES_EXCLUES[nomComplet] || []).includes(c.nom));
        const noms = colonnes.map((c) => c.nom);
        const liste = noms.map((n) => `"${n}"`).join(", ");
        if (PAR_ANNEE[nomComplet]) {
            for (const annee of annees) {
                const lignes = (await db.query(PAR_ANNEE[nomComplet], [annee])).rows;
                ecrireCsv(path.join(DOSSIER, o.schema, o.nom, `${annee}.csv`), noms, lignes);
            }
        } else {
            const ordre = o.type === "r" ? "ORDER BY 1" : "";
            const lignes = (await db.query(`SELECT ${liste} FROM ${nomComplet} ${ordre}`)).rows;
            ecrireCsv(path.join(DOSSIER, o.schema, `${o.nom}.csv`), noms, lignes);
        }
        dictionnaire.push({ ...o, colonnes, parAnnee: !!PAR_ANNEE[nomComplet] });
    }

    // Dictionnaire des données, tiré des descriptions stockées dans la base.
    const descriptionsSchemas = new Map((await db.query(
        "SELECT nspname, obj_description(oid) AS d FROM pg_namespace WHERE nspname = ANY($1)", [SCHEMAS])).rows.map((r) => [r.nspname, r.d]));
    const md = [
        "# Données Family Hub",
        "",
        `Export du ${new Date().toISOString().slice(0, 10)} (base ${base}), généré par \`scripts/exporter-donnees.js\` de Chow.`,
        "Ne pas modifier à la main : relancer l'export.",
        "",
        "## Format",
        "",
        "- CSV en UTF-8, séparateur virgule, point décimal, première ligne = noms de colonnes.",
        "- Dates `AAAA-MM-JJ`, instants avec fuseau, montants en euros.",
        "- Les tables qui grossissent sont découpées par année (`achats/lignes/2026.csv`).",
        "- Les noms commençant par `v_` sont des vues : des calculs tirés des tables, pas des faits.",
        "- Non exportés : empreintes de mot de passe, photos des Courses, données techniques (`app`).",
        "- `sauvegardes/` contient des `pg_dump` complets (restaurer avec `pg_restore`), hors Git.",
        "",
    ];
    for (const schema of SCHEMAS) {
        md.push(`## ${schema}`, "", descriptionsSchemas.get(schema) || "", "");
        for (const o of dictionnaire.filter((d) => d.schema === schema)) {
            md.push(`### ${o.nom}${o.type === "v" ? " (vue)" : ""}${o.parAnnee ? " — un fichier par année" : ""}`, "");
            if (o.description) md.push(o.description, "");
            for (const c of o.colonnes) md.push(`- \`${c.nom}\` (${c.type})${c.description ? " : " + c.description : ""}`);
            md.push("");
        }
    }
    fs.writeFileSync(path.join(DOSSIER, "README.md"), md.join("\n"));
    fs.writeFileSync(path.join(DOSSIER, ".gitignore"), "sauvegardes/\n.DS_Store\n");
    console.log(`${dictionnaire.length} tables et vues exportées.`);
} finally {
    await db.end();
}

// Sauvegarde complète restaurable, les 12 dernières gardées.
const dossierSauvegardes = path.join(DOSSIER, "sauvegardes");
fs.mkdirSync(dossierSauvegardes, { recursive: true });
const fichier = path.join(dossierSauvegardes, `${new Date().toISOString().slice(0, 10)}-family-hub.dump`);
execFileSync("pg_dump", ["--format=custom", "--no-owner", `--file=${fichier}`, process.env.DATABASE_URL], { stdio: "inherit" });
const anciennes = fs.readdirSync(dossierSauvegardes).filter((f) => f.endsWith(".dump")).sort().slice(0, -SAUVEGARDES_GARDEES);
for (const f of anciennes) fs.rmSync(path.join(dossierSauvegardes, f));
console.log("Sauvegarde :", path.relative(DOSSIER, fichier));
