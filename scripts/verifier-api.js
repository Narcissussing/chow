import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";
import { spawn } from "node:child_process";

const ENDPOINT_DEV = "ep-spring-truth-b9vjj7sz";
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

async function arreterServeur(s) {
    await new Promise((r) => { s.once("exit", r); s.kill(); });
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
let serveur = await demarrerServeur();

try {
    const hash = await bcrypt.hash(MOT_DE_PASSE, 10);
    await db.query("INSERT INTO famille.comptes (email, mot_de_passe) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET mot_de_passe = $2", [EMAIL, hash]);

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
    for (let i = 0; i < 4; i++) await appel("POST", "/api/login", { email: EMAIL, password: "faux" });
    r = await appel("POST", "/api/login", { email: EMAIL, password: "faux" });
    verifier("6e échec de connexion → 429", r.statut === 429, String(r.statut));
    r = await appel("POST", "/api/login", { email: EMAIL, password: MOT_DE_PASSE });
    verifier("même le bon mot de passe est bloqué", r.statut === 429);
    const blocage = await db.query("SELECT jusqua > NOW() + INTERVAL '29 days' AS mois FROM app.ip_bloquees WHERE ip IN ('::1', '127.0.0.1', '::ffff:127.0.0.1')");
    verifier("IP bloquée 30 jours en base", blocage.rows[0]?.mois === true);
    await arreterServeur(serveur);
    serveur = await demarrerServeur();
    r = await appel("POST", "/api/login", { email: EMAIL, password: MOT_DE_PASSE });
    verifier("blocage IP conservé après redémarrage", r.statut === 429);
    await db.query("DELETE FROM app.ip_bloquees WHERE ip IN ('::1', '127.0.0.1', '::ffff:127.0.0.1')");
    await arreterServeur(serveur);
    serveur = await demarrerServeur();
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
    verifier("GET /api/courses", r.statut === 200 && ["courses", "aliments", "articles", "stock", "presetHebdo"].every((k) => Array.isArray(r.donnees?.[k])));
    r = await appel("GET", "/api/courses/estimation");
    const e = r.donnees;
    verifier("GET /api/courses/estimation", r.statut === 200 && e.bas <= e.estimation && e.estimation <= e.haut && e.sansPrix <= e.articles, JSON.stringify(e));
    console.log("     estimation :", JSON.stringify(e));
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
    if (idCourse) nettoyages.push(() => db.query("DELETE FROM chow.courses WHERE id = $1", [idCourse]));
    verifier("POST /api/courses/ajouter (texte libre)", r.statut === 200 && r.donnees?.item?.nom === MARQUEUR);
    const inventaireAvant = await db.query("SELECT article_id, quantite, niveau FROM maison.inventaire WHERE article_id IN ('shampoing', 'dentifrice')");
    r = await appel("POST", "/api/courses/ajouter", { idArticle: "shampoing" });
    const idCourseArticle = r.donnees?.item?.id;
    if (idCourseArticle) nettoyages.push(() => db.query("DELETE FROM chow.courses WHERE id = $1", [idCourseArticle]));
    verifier("POST /api/courses/ajouter (article de la maison)", r.statut === 200 && r.donnees?.item?.nom === "Shampoing" && r.donnees.item.categorie === "Hygiène" && r.donnees.item.famille_id === "hygiene", JSON.stringify(r.donnees?.item));
    r = await appel("POST", "/api/courses/acheter", { idCourse: idCourseArticle });
    verifier("POST /api/courses/acheter (article au niveau → plein)", r.donnees?.succes === true);
    nettoyages.push(async () => {
        await db.query("DELETE FROM maison.inventaire WHERE article_id IN ('shampoing', 'dentifrice')");
        for (const l of inventaireAvant.rows) {
            await db.query("INSERT INTO maison.inventaire (article_id, quantite, niveau) VALUES ($1, $2, $3)", [l.article_id, l.quantite, l.niveau]);
        }
    });
    const shampoing = (await db.query("SELECT niveau FROM maison.inventaire WHERE article_id = 'shampoing'")).rows[0];
    verifier("inventaire : shampoing plein", shampoing?.niveau === "plein");
    r = await appel("POST", "/api/courses/ajouter", { idArticle: "dentifrice" });
    const idCourseDentifrice = r.donnees?.item?.id;
    if (idCourseDentifrice) nettoyages.push(() => db.query("DELETE FROM chow.courses WHERE id = $1", [idCourseDentifrice]));
    verifier("article au nombre → suivi à l'unité", r.donnees?.item?.tracking_type === "unite");
    const dentifriceAvant = Number(inventaireAvant.rows.find((l) => l.article_id === "dentifrice")?.quantite || 0);
    r = await appel("POST", "/api/courses/acheter", { idCourse: idCourseDentifrice, quantiteAchetee: 2 });
    const dentifrice = (await db.query("SELECT quantite FROM maison.inventaire WHERE article_id = 'dentifrice'")).rows[0];
    verifier("POST /api/courses/acheter (article au nombre, +2)", r.donnees?.succes === true && Number(dentifrice?.quantite) === dentifriceAvant + 2);
    // Tournée : ouverte par le mode magasin, l'achat garde enseigne et quantité, le panier les valorise, « Terminer » la ferme.
    const tourneeAvant = (await db.query("SELECT id FROM chow.tournees WHERE fin IS NULL")).rows[0];
    r = await appel("POST", "/api/courses/tournee/commencer", {});
    const tourneeTest = (await db.query("SELECT id FROM chow.tournees WHERE fin IS NULL")).rows[0];
    nettoyages.push(async () => {
        if (tourneeAvant) await db.query("UPDATE chow.tournees SET fin = NULL WHERE id = $1", [tourneeAvant.id]);
        else if (tourneeTest) await db.query("DELETE FROM chow.tournees WHERE id = $1", [tourneeTest.id]);
    });
    verifier("POST /api/courses/tournee/commencer", r.donnees?.succes === true && r.donnees.panier?.tournee?.id === tourneeTest?.id);
    r = await appel("POST", "/api/courses/ajouter", { idArticle: "dentifrice" });
    const idCourseTournee = r.donnees?.item?.id;
    if (idCourseTournee) nettoyages.unshift(() => db.query("DELETE FROM chow.courses WHERE id = $1", [idCourseTournee]));
    r = await appel("POST", "/api/courses/acheter", { idCourse: idCourseTournee, quantiteAchetee: 2, magasin: "Leclerc" });
    r = await appel("GET", "/api/courses/panier");
    const lignePanier = r.donnees?.lignes?.find((l) => l.id === idCourseTournee);
    verifier("GET /api/courses/panier : article coché valorisé (2 × prix à la pièce), enseigne gardée",
        lignePanier?.achete === true && lignePanier.enseigne === "Leclerc" && lignePanier.rayon === "Maison" && lignePanier.valeur > lignePanier.prevu, JSON.stringify(lignePanier));
    r = await appel("POST", "/api/courses/tournee/terminer", {});
    const ouverte = (await db.query("SELECT count(*)::int AS n FROM chow.tournees WHERE fin IS NULL")).rows[0].n;
    verifier("POST /api/courses/tournee/terminer", r.donnees?.succes === true && ouverte === 0);
    r = await appel("POST", "/api/courses/commentaire", { idCourse, commentaire: "note de test" });
    verifier("POST /api/courses/commentaire", r.donnees?.succes === true);
    r = await appel("POST", "/api/courses/supprimer", { idCourse });
    verifier("POST /api/courses/supprimer", r.donnees?.succes === true);
    r = await appel("GET", "/api/courses/" + idCourse + "/photo");
    verifier("GET /api/courses/:id/photo sans photo → 404", r.statut === 404);

    const horsStock = aliments.find((a) => a.tracking_type !== "cl" && !stockActuel.some((s) => s.food_id === a.id));
    r = await appel("POST", "/api/stock/ajouter", { idAliment: horsStock.id, quantiteAliment: 1 });
    const idStock = r.donnees?.item?.id;
    if (idStock) nettoyages.push(() => db.query("DELETE FROM chow.stock WHERE id = $1", [idStock]));
    verifier("POST /api/stock/ajouter", r.statut === 200 && idStock);
    r = await appel("POST", "/api/stock/modifier", { idStock, nouvelleQuantite: "2" });
    verifier("POST /api/stock/modifier", r.donnees?.quantite === "2");
    await db.query("UPDATE chow.stock SET date_maj = CURRENT_DATE - 30 WHERE id = $1", [idStock]);
    r = await appel("POST", "/api/stock/verifier", { idStock, fini: false });
    let dateMaj = await db.query("SELECT quantite, date_maj = CURRENT_DATE AS jour FROM chow.stock WHERE id = $1", [idStock]);
    verifier("vérifier « toujours là » : même quantité, date du jour", r.donnees?.succes && dateMaj.rows[0].quantite === "2" && dateMaj.rows[0].jour);
    r = await appel("POST", "/api/stock/verifier", { idStock, fini: true });
    verifier("vérifier « fini » : article vidé", ["0", "vide"].includes(r.donnees?.quantite));
    r = await appel("POST", "/api/stock/supprimer", { idStock });
    verifier("POST /api/stock/supprimer", r.donnees?.succes === true);

    const horsJournal = aliments.find((a) => !journalActuel.some((j) => j.food_id === a.id));
    r = await appel("POST", "/api/calories/ajouter", { idAliment: horsJournal.id, quantiteG: 100 });
    const idEntree = r.donnees?.item?.id;
    if (idEntree) nettoyages.push(() => db.query("DELETE FROM chow.journal WHERE id = $1", [idEntree]));
    verifier("POST /api/calories/ajouter", r.statut === 200 && idEntree);
    r = await appel("POST", "/api/calories/modifier", { idEntree, nouvelleQuantite: 50 });
    verifier("POST /api/calories/modifier", r.donnees?.item?.calories_calc !== undefined);
    r = await appel("POST", "/api/calories/reordonner", { ids: [] });
    verifier("POST /api/calories/reordonner invalide → 400", r.statut === 400);
    r = await appel("POST", "/api/calories/supprimer", { idEntree });
    verifier("POST /api/calories/supprimer", r.donnees?.succes === true);

    r = await appel("GET", "/api/stats?periode=annee&ref=2026-01-01&enseigne=tous");
    const st = r.donnees;
    verifier("GET /api/stats (année)", r.statut === 200 && st.barres?.pas === "annee" && typeof st.kpi?.depense === "number" && Array.isArray(st.produits));
    verifier("inflation nationale INSEE jointe", st.inflation.some((m) => m.national !== null) && typeof st.inflationNationale?.variation === "number");
    const barreAnnee = st.barres.seaux.find((x) => x.debut === st.barres.selection);
    verifier("barre de l'année choisie = total dépensé", Math.abs(barreAnnee.total - st.kpi.depense) < 0.05, `${barreAnnee.total} / ${st.kpi.depense}`);
    r = await appel("GET", "/api/stats?periode=semaine&ref=2026-10-14&enseigne=Leclerc");
    verifier("GET /api/stats (semaine, un magasin) : 12 semaines", r.statut === 200 && r.donnees.barres.seaux.length === 12 && r.donnees.barres.selection === "2026-10-12" && r.donnees.parMagasin.every((m) => m.nom === "Leclerc"));
    r = await appel("GET", "/api/stats?periode=mois&ref=2026-10-01&enseigne=tous");
    verifier("GET /api/stats (mois) : 12 mois", r.statut === 200 && r.donnees.barres.pas === "mois" && r.donnees.barres.seaux.length === 12);
    r = await appel("GET", "/api/stats/tickets?periode=semaine&ref=2026-10-29&enseigne=tous");
    const tk = r.donnees;
    verifier("GET /api/stats/tickets (semaine) : total = somme des tickets", r.statut === 200 && tk.debut === "2026-10-26"
        && Math.abs(tk.total - tk.tickets.reduce((s, t) => s + t.paye, 0)) < 0.01 && tk.niveaux.length === 3 && tk.articles.every((a) => !/[A-Z]{4,}/.test(a.nom)));
    r = await appel("GET", "/api/stats/tickets?periode=dates&debut=2026-10-24&fin=2026-10-29&enseigne=tous");
    verifier("GET /api/stats/tickets (dates choisies)", r.statut === 200 && r.donnees.debut === "2026-10-24" && r.donnees.fin === "2026-10-30"
        && r.donnees.tickets.every((t) => t.jour >= "2026-10-24" && t.jour <= "2026-10-29") && r.donnees.precedent === null);
    r = await appel("GET", "/api/stats/tickets?periode=jour&ref=2026-10-29&enseigne=Leclerc");
    verifier("GET /api/stats/tickets (jour, un magasin)", r.statut === 200 && r.donnees.tickets.every((t) => t.enseigne === "Leclerc" && t.jour === "2026-10-29"));
    r = await appel("POST", "/api/articles/frites/a-reduire", { niveau: 1 });
    const fritesNiveau = (await db.query("SELECT a_reduire FROM achats.articles WHERE id = 'frites'")).rows[0]?.a_reduire;
    await appel("POST", "/api/articles/frites/a-reduire", { niveau: null });
    verifier("POST /api/articles/:id/a-reduire : article mis puis retiré du niveau", r.statut === 200 && fritesNiveau === 1);
    r = await appel("POST", "/api/articles/frites/a-reduire", { niveau: 3 });
    verifier("POST /api/articles/:id/a-reduire niveau 3 refusé → 400", r.statut === 400);
    r = await appel("GET", "/api/plan");
    const oeufs = r.donnees?.articles.find((a) => a.id === "oeuf-moyen");
    verifier("GET /api/plan : œufs gardés par choix", r.statut === 200 && oeufs?.section === "choix" && oeufs.choix?.preference);
    const chips = r.donnees.articles.find((a) => a.id === "chips");
    const choixAvant = chips?.choix ?? null;
    r = await appel("POST", "/api/plan/chips", { decision: "moins", quantiteVisee: 1 });
    r = await appel("GET", "/api/plan");
    const chipsApres = r.donnees.articles.find((a) => a.id === "chips");
    verifier("POST /api/plan/:id (moins) : économie calculée", chipsApres?.choix?.decision === "moins" && chipsApres.economieMois > 0);
    await appel("POST", "/api/plan/chips", choixAvant ? { decision: choixAvant.decision, quantiteVisee: choixAvant.quantiteVisee } : { decision: null });
    r = await appel("POST", "/api/plan/chips", { decision: "peut-etre" });
    verifier("POST /api/plan/:id invalide → 400", r.statut === 400);
    r = await appel("GET", "/api/jetes?mois=2026-10");
    const tomates = r.donnees?.lignes.find((l) => l.id === "tomate");
    verifier("GET /api/jetes : aliments habituels", r.statut === 200 && tomates && Array.isArray(r.donnees.autres));
    const jeteAvant = tomates?.quantite ?? 0;
    await appel("POST", "/api/jetes", { article: "tomate", mois: "2026-10", quantite: 1.2, unite: "kg" });
    r = await appel("GET", "/api/jetes?mois=2026-10");
    verifier("POST /api/jetes : quantité et montant", r.donnees.lignes.find((l) => l.id === "tomate")?.quantite === 1.2 && r.donnees.total > 0);
    await appel("POST", "/api/jetes", { article: "tomate", mois: "2026-10", quantite: jeteAvant, unite: "kg" });
    r = await appel("GET", "/api/stats/produit/tomate");
    verifier("GET /api/stats/produit/:id", r.statut === 200 && r.donnees.produit?.courbe.length > 0);
    r = await appel("GET", "/api/stats/produit/inconnu");
    verifier("produit sans achat → 404", r.statut === 404);
    r = await appel("GET", "/api/accueil");
    verifier("GET /api/accueil", r.statut === 200 && ["stock", "stock_a_verifier", "courses", "depense_mois", "depense_semaine", "depense_mois_dernier"].every((k) => typeof r.donnees?.[k] === "number") && r.donnees.semaines.length === 8 && Array.isArray(r.donnees.aVerifier));

    const avecEquiv = aliments[0];
    const equivalences = {
        grammesCafe: avecEquiv.grammes_par_cuil_a_cafe ?? "",
        grammesSoupe: avecEquiv.grammes_par_cuil_a_soupe ?? "",
    };
    r = await appel("POST", `/api/aliments/${encodeURIComponent(avecEquiv.id)}/equivalences`, equivalences);
    verifier("équivalences refusées à un compte non admin → 403", r.statut === 403);
    await db.query("UPDATE famille.comptes SET admin = true WHERE email = $1", [EMAIL]);
    r = await appel("GET", "/api/session");
    verifier("session admin", r.donnees?.utilisateur?.admin === true);
    r = await appel("POST", `/api/aliments/${encodeURIComponent(avecEquiv.id)}/equivalences`, equivalences);
    verifier("POST /api/aliments/:id/equivalences en admin (valeurs inchangées)", r.donnees?.succes === true);
    await db.query("UPDATE famille.comptes SET admin = false WHERE email = $1", [EMAIL]);

    const ingredients = aliments.slice(0, 2).map((a) => ({ food_id: a.id, quantite_g: 10 }));
    r = await appel("POST", "/api/recettes/creer", { nom: MARQUEUR, categorie: "plat", etapes: "a\nb", ingredients });
    const idRecette = r.donnees?.recette?.id;
    if (idRecette) nettoyages.push(async () => {
        await db.query("DELETE FROM chow.recette_ingredients WHERE recette_id = $1", [idRecette]);
        await db.query("DELETE FROM chow.recettes WHERE id = $1", [idRecette]);
    });
    verifier("POST /api/recettes/creer", r.statut === 200 && idRecette);
    r = await appel("POST", "/api/recettes/creer", { nom: MARQUEUR + "-partielle", categorie: "plat", ingredients: [...ingredients, { food_id: "aliment-inexistant", quantite_g: 10 }] });
    const partielle = await db.query("SELECT count(*)::int AS n FROM chow.recettes WHERE nom = $1", [MARQUEUR + "-partielle"]);
    verifier("recette avec un ingrédient refusé : rien n'est créé", r.statut === 500 && partielle.rows[0].n === 0);
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
    // Le test de blocage vise localhost : toujours débloqué, même si le script s'arrête en route.
    await db.query("DELETE FROM app.ip_bloquees WHERE ip IN ('::1', '127.0.0.1', '::ffff:127.0.0.1')");
    const u = await db.query("DELETE FROM famille.comptes WHERE email = $1 RETURNING id", [EMAIL]);
    if (u.rows[0]) await db.query("DELETE FROM app.sessions WHERE (sess->'passport'->>'user')::int = $1", [u.rows[0].id]);
    await db.end();
    serveur.kill();
    console.log(echecs === 0 ? "\nTout est conforme ; données de test supprimées." : `\n${echecs} échec(s) ; données de test supprimées.`);
    process.exit(echecs === 0 ? 0 : 1);
}
