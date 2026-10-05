import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";
import { spawn } from "node:child_process";

const ENDPOINT_DEV = "ep-spring-river-aslzwhz5";
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes(ENDPOINT_DEV)) {
    console.error("Refusé : DATABASE_URL ne vise pas la branche Neon dev (" + ENDPOINT_DEV + ").");
    process.exit(1);
}

const PORT = 3197;
const BASE = `http://localhost:${PORT}`;
const EMAIL = "verifier-api@chow.local";
const MOT_DE_PASSE = "verifier-api-" + Date.now();
const MARQUEUR = "__verifier_api__";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
let cookie = "";
let echecs = 0;
const nettoyages = [];

function verifier(nom, ok, detail = "") {
    console.log(`${ok ? "OK  " : "ÉCHEC"} ${nom}${!ok && detail ? " — " + detail : ""}`);
    if (!ok) echecs++;
}

async function appel(methode, chemin, corps, { json = true, redirect = "manual" } = {}) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    let body;
    if (corps !== undefined) {
        headers["Content-Type"] = json ? "application/json" : "application/x-www-form-urlencoded";
        body = json ? JSON.stringify(corps) : new URLSearchParams(corps).toString();
    }
    const reponse = await fetch(BASE + chemin, { method: methode, headers, body, redirect });
    const setCookie = reponse.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const texte = await reponse.text();
    let donnees = null;
    try { donnees = JSON.parse(texte); } catch { }
    return { statut: reponse.status, donnees, texte, setCookie, location: reponse.headers.get("location") };
}

async function demarrerServeur() {
    const serveur = spawn(process.execPath, ["index.js"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
    for (let i = 0; i < 40; i++) {
        try { await fetch(BASE + "/login"); return serveur; } catch { await new Promise((r) => setTimeout(r, 250)); }
    }
    serveur.kill();
    throw new Error("Le serveur ne démarre pas sur le port " + PORT);
}

await db.connect();
const serveur = await demarrerServeur();

try {
    const hash = await bcrypt.hash(MOT_DE_PASSE, 10);
    await db.query("INSERT INTO users (email, password) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password = $2", [EMAIL, hash]);

    let r = await appel("GET", "/api/session");
    verifier("session sans cookie → 401 JSON", r.statut === 401 && r.donnees?.erreur === "Non connecté.");
    r = await appel("GET", "/api/stock");
    verifier("lecture sans session → 401 JSON", r.statut === 401 && r.donnees?.erreur === "Non connecté.");
    r = await appel("GET", "/stock");
    verifier("page sans session → app React (elle redirige elle-même vers /login)", r.statut === 200 && r.texte.includes('id="root"'));

    r = await appel("POST", "/api/login", { email: EMAIL, password: MOT_DE_PASSE }, { json: false });
    verifier("login en formulaire → 415", r.statut === 415);
    r = await appel("POST", "/api/login", { email: EMAIL, password: "faux" });
    verifier("login faux → 401 + message", r.statut === 401 && r.donnees?.erreur === "Email ou mot de passe incorrect.");
    r = await appel("POST", "/api/login", { email: EMAIL, password: MOT_DE_PASSE });
    verifier("login juste → utilisateur sans mot de passe", r.statut === 200 && r.donnees?.utilisateur?.email === EMAIL && !("password" in r.donnees.utilisateur));
    verifier("cookie HttpOnly + SameSite=Lax", /HttpOnly/.test(r.setCookie || "") && /SameSite=Lax/i.test(r.setCookie || ""), r.setCookie);
    r = await appel("GET", "/api/session");
    verifier("session conservée", r.statut === 200 && r.donnees?.utilisateur?.email === EMAIL);

    r = await appel("GET", "/api/aliments");
    const aliments = r.donnees?.aliments || [];
    verifier("GET /api/aliments", r.statut === 200 && aliments.length > 0);
    r = await appel("GET", "/api/aliments/" + encodeURIComponent(aliments[0].id));
    verifier("GET /api/aliments/:id", r.statut === 200 && r.donnees?.aliment?.id === aliments[0].id);
    r = await appel("GET", "/api/aliments/" + MARQUEUR);
    verifier("aliment inconnu → 404 JSON", r.statut === 404 && r.donnees?.erreur === "Aliment introuvable.");
    r = await appel("GET", "/api/stock");
    verifier("GET /api/stock", r.statut === 200 && Array.isArray(r.donnees?.stock) && Array.isArray(r.donnees?.aliments));
    const stockActuel = r.donnees.stock;
    r = await appel("GET", "/api/courses");
    verifier("GET /api/courses", r.statut === 200 && ["courses", "aliments", "stock", "presetHebdo"].every((k) => Array.isArray(r.donnees?.[k])));
    r = await appel("GET", "/api/calories");
    verifier("GET /api/calories", r.statut === 200 && ["journal", "aliments", "recettes"].every((k) => Array.isArray(r.donnees?.[k])));
    const journalActuel = r.donnees.journal;
    r = await appel("GET", "/api/inexistante");
    verifier("route /api inconnue → 404 JSON", r.statut === 404 && r.donnees?.erreur === "Route inconnue.");
    r = await appel("GET", "/aliments");
    verifier("page connectée → app React", r.statut === 200 && r.texte.includes('id="root"'));
    r = await appel("POST", "/stock/ajouter", { idAliment: "x", quantiteAliment: 1 });
    verifier("ancien chemin sans /api → plus servi", r.statut !== 200);

    r = await appel("POST", "/api/courses/ajouter", { rechercheAliment: MARQUEUR });
    const idCourse = r.donnees?.item?.id;
    if (idCourse) nettoyages.push(() => db.query("DELETE FROM courses WHERE id = $1", [idCourse]));
    verifier("POST /api/courses/ajouter (texte libre)", r.statut === 200 && r.donnees?.item?.nom === MARQUEUR);
    r = await appel("POST", "/api/courses/commentaire", { idCourse, commentaire: "note de test" });
    verifier("POST /api/courses/commentaire", r.donnees?.succes === true);
    r = await appel("POST", "/api/courses/supprimer", { idCourse });
    verifier("POST /api/courses/supprimer", r.donnees?.succes === true);
    r = await appel("GET", "/api/courses/" + idCourse + "/photo");
    verifier("GET /api/courses/:id/photo sans photo → 404", r.statut === 404);

    const horsStock = aliments.find((a) => a.tracking_type !== "cl" && !stockActuel.some((s) => s.food_id === a.id));
    r = await appel("POST", "/api/stock/ajouter", { idAliment: horsStock.id, quantiteAliment: 1 });
    const idStock = r.donnees?.item?.id;
    if (idStock) nettoyages.push(() => db.query("DELETE FROM stock WHERE id = $1", [idStock]));
    verifier("POST /api/stock/ajouter", r.statut === 200 && idStock);
    r = await appel("POST", "/api/stock/modifier", { idStock, nouvelleQuantite: "2" });
    verifier("POST /api/stock/modifier", r.donnees?.quantite === "2");
    r = await appel("POST", "/api/stock/supprimer", { idStock });
    verifier("POST /api/stock/supprimer", r.donnees?.succes === true);

    const horsJournal = aliments.find((a) => !journalActuel.some((j) => j.food_id === a.id));
    r = await appel("POST", "/api/calories/ajouter", { idAliment: horsJournal.id, quantiteG: 100 });
    const idEntree = r.donnees?.item?.id;
    if (idEntree) nettoyages.push(() => db.query("DELETE FROM journal_repas WHERE id = $1", [idEntree]));
    verifier("POST /api/calories/ajouter", r.statut === 200 && idEntree);
    r = await appel("POST", "/api/calories/modifier", { idEntree, nouvelleQuantite: 50 });
    verifier("POST /api/calories/modifier", r.donnees?.item?.calories_calc !== undefined);
    r = await appel("POST", "/api/calories/reordonner", { ids: [] });
    verifier("POST /api/calories/reordonner invalide → 400", r.statut === 400);
    r = await appel("POST", "/api/calories/supprimer", { idEntree });
    verifier("POST /api/calories/supprimer", r.donnees?.succes === true);

    const avecEquiv = aliments[0];
    r = await appel("POST", `/api/aliments/${encodeURIComponent(avecEquiv.id)}/equivalences`, {
        grammesCafe: avecEquiv.grammes_par_cuil_a_cafe ?? "",
        grammesSoupe: avecEquiv.grammes_par_cuil_a_soupe ?? "",
    });
    verifier("POST /api/aliments/:id/equivalences (valeurs inchangées)", r.donnees?.succes === true);

    const ingredients = aliments.slice(0, 2).map((a) => ({ food_id: a.id, quantite_g: 10 }));
    r = await appel("POST", "/api/recettes/creer", { nom: MARQUEUR, categorie: "plat", etapes: "a\nb", ingredients });
    const idRecette = r.donnees?.recette?.id;
    if (idRecette) nettoyages.push(async () => {
        await db.query("DELETE FROM recette_ingredients WHERE recette_id = $1", [idRecette]);
        await db.query("DELETE FROM recettes WHERE id = $1", [idRecette]);
    });
    verifier("POST /api/recettes/creer", r.statut === 200 && idRecette);
    r = await appel("GET", "/api/recettes/" + idRecette);
    verifier("GET /api/recettes/:id", r.donnees?.recette?.etapes === "a\nb" && r.donnees?.ingredients?.length === 2);
    r = await appel("POST", `/api/recettes/${idRecette}/modifier`, { nom: MARQUEUR, categorie: "fraicheur", etapes: "c", ingredients });
    verifier("POST /api/recettes/:id/modifier", r.donnees?.recette?.etapes === "c");
    r = await appel("POST", `/api/recettes/${idRecette}/supprimer`, {});
    verifier("POST /api/recettes/:id/supprimer", r.donnees?.succes === true);
    r = await appel("GET", "/api/recettes/" + idRecette);
    verifier("recette supprimée → 404", r.statut === 404);

    r = await appel("POST", "/api/logout", {});
    verifier("POST /api/logout", r.donnees?.succes === true);
    r = await appel("GET", "/api/session");
    verifier("session terminée après logout", r.statut === 401);
} catch (err) {
    echecs++;
    console.error("ERREUR inattendue :", err.message);
} finally {
    for (const nettoyer of nettoyages) await nettoyer();
    const u = await db.query("DELETE FROM users WHERE email = $1 RETURNING id", [EMAIL]);
    if (u.rows[0]) await db.query("DELETE FROM session WHERE (sess->'passport'->>'user')::int = $1", [u.rows[0].id]);
    await db.end();
    serveur.kill();
    console.log(echecs === 0 ? "\nTout est conforme ; données de test supprimées." : `\n${echecs} échec(s) ; données de test supprimées.`);
    process.exit(echecs === 0 ? 0 : 1);
}
