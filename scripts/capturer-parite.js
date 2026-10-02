// Usage : node scripts/capturer-parite.js — capture chaque page EJS après exécution de ses scripts + la réponse /api correspondante (branche Neon dev).
// Les fichiers *.generated.json (ignorés par Git) servent au test de parité Jest du frontend.
import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "../frontend/node_modules/jsdom/lib/api.js";

const ENDPOINT_DEV = "ep-spring-river-aslzwhz5";
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes(ENDPOINT_DEV)) {
    console.error("Refusé : DATABASE_URL ne vise pas la branche Neon dev (" + ENDPOINT_DEV + ").");
    process.exit(1);
}

const PORT = 3198;
const BASE = `http://localhost:${PORT}`;
const EMAIL = "capturer-parite@chow.local";
const MOT_DE_PASSE = "capturer-parite-" + Date.now();
const DOSSIER = new URL("../frontend/src/__parite__/", import.meta.url);

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const premierAliment = (await db.query("SELECT id FROM foods ORDER BY id LIMIT 1")).rows[0].id;

// Page EJS, données /api lues par React, nom du fichier de capture.
const PAGES = [
    { nom: "accueil", chemin: "/", api: {} },
    { nom: "aliments", chemin: "/aliments", api: { "/aliments": "/api/aliments" } },
    { nom: "aliment-detail", chemin: "/aliments/" + premierAliment, api: { ["/aliments/" + premierAliment]: "/api/aliments/" + premierAliment } },
    { nom: "aliment-inconnu", chemin: "/aliments/inexistant", api: { "/aliments/inexistant": "/api/aliments/inexistant" } },
    { nom: "stock", chemin: "/stock", api: { "/stock": "/api/stock" } },
    { nom: "courses", chemin: "/courses", api: { "/courses": "/api/courses" } },
    {
        nom: "calories",
        chemin: "/calories",
        api: { "/calories": "/api/calories" },
        extra: ["#sheetBackdrop", "#sheet"],
        // Lignes temporaires couvrant chaque unité (c. à café, c. à soupe, pièce), supprimées après la capture.
        async preparer() {
            const choix = await db.query(`
                (SELECT id FROM foods WHERE grammes_par_cuil_a_cafe IS NOT NULL ORDER BY id LIMIT 1)
                UNION (SELECT id FROM foods WHERE grammes_par_cuil_a_soupe IS NOT NULL ORDER BY id LIMIT 1)
                UNION (SELECT id FROM foods WHERE tracking_type = 'unite' AND poids_unite_g > 0 ORDER BY id LIMIT 1)
                UNION (SELECT id FROM foods WHERE tracking_type = 'cl' ORDER BY id LIMIT 1)`);
            const ids = [];
            for (const { id } of choix.rows) {
                const r = await fetch(BASE + "/api/calories/ajouter", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ idAliment: id, quantiteG: 37.5 }) });
                ids.push((await r.json()).item.id);
            }
            return () => db.query("DELETE FROM journal_repas WHERE id = ANY($1)", [ids]);
        },
    },
];

const serveur = spawn(process.execPath, ["index.js"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
let cookie = "";

try {
    for (let i = 0; i < 40; i++) {
        try { await fetch(BASE + "/login"); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
    }
    await db.query("INSERT INTO users (email, password) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password = $2", [EMAIL, await bcrypt.hash(MOT_DE_PASSE, 10)]);
    const login = await fetch(BASE + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: MOT_DE_PASSE }),
    });
    cookie = login.headers.get("set-cookie").split(";")[0];

    mkdirSync(DOSSIER, { recursive: true });
    for (const page of PAGES) {
        const nettoyer = page.preparer ? await page.preparer() : null;
        try {
        const html = await (await fetch(BASE + page.chemin, { headers: { Cookie: cookie } })).text();
        // Exécute les scripts de la page (custom-selects.js, aliments.js…) comme un navigateur, avec la session.
        const dom = new JSDOM(html, {
            url: BASE + page.chemin,
            runScripts: "dangerously",
            resources: "usable",
            pretendToBeVisual: true,
            virtualConsole: new VirtualConsole().on("jsdomError", (e) => console.error("ERREUR SCRIPT", page.nom, e.message)),
            beforeParse(window) {
                window.scrollTo = () => {};
                window.IntersectionObserver = class { observe() {} disconnect() {} };
                window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
                // jsdom n'a pas fetch : sans lui, courses.js s'arrêtait avant ses dernières lignes.
                window.fetch = (url, options = {}) =>
                    fetch(new URL(url, BASE), { ...options, headers: { ...(options.headers || {}), Cookie: cookie } });
            },
        });
        dom.window.document.cookie = cookie;
        await new Promise((resolve) => dom.window.addEventListener("load", resolve));
        await new Promise((r) => setTimeout(r, 300));

        const api = {};
        for (const [cheminReact, cheminApi] of Object.entries(page.api)) {
            const reponse = await fetch(BASE + cheminApi, { headers: { Cookie: cookie } });
            api[cheminReact] = [reponse.status, await reponse.json()];
        }
        const main = dom.window.document.querySelector("main");
        writeFileSync(new URL(page.nom + ".generated.json", DOSSIER), JSON.stringify({
            chemin: page.chemin,
            titre: dom.window.document.title,
            main: main ? main.outerHTML : null,
            footer: dom.window.document.querySelector("footer")?.outerHTML ?? null,
            // Éléments hors <main> (panneau recette de Calories).
            extra: Object.fromEntries((page.extra || []).map((sel) => [sel, dom.window.document.querySelector(sel)?.outerHTML ?? null])),
            api,
        }, null, 1));
        dom.window.close();
        console.log("capturé :", page.nom);
        } finally {
            if (nettoyer) await nettoyer();
        }
    }
} finally {
    const u = await db.query("DELETE FROM users WHERE email = $1 RETURNING id", [EMAIL]);
    if (u.rows[0]) await db.query("DELETE FROM session WHERE (sess->'passport'->>'user')::int = $1", [u.rows[0].id]);
    await db.end();
    serveur.kill();
}
