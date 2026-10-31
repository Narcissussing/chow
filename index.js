import express from "express";
import fs from "fs";
import pg from "pg";
import "dotenv/config";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { calculerStats, ficheProduit, jourIso, prevoirArticle, quantile } from "./stats.js";
import { bornesTickets, detailTickets } from "./tickets.js";
import { habitudes, plan } from "./plan.js";

const app = express();

const port = process.env.PORT || 3000;

// Connexions fermées après 10 s sans requête : Neon peut se mettre en veille quand personne n'utilise Chow.
const db = new pg.Pool({
    ...(process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
        }),
    idleTimeoutMillis: 10000,
});
db.on("error", (err) => console.log("ERREUR connexion:", err.message));

async function enTransaction(travail) {
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const resultat = await travail(client);
        await client.query("COMMIT");
        return resultat;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

// Migrations de l'ancienne base (tables dans public) : rejouées seulement tant qu'elle n'est pas passée aux domaines.
const MIGRATION_DOMAINES = "2026-10-30-1-schemas-par-domaine.sql";
const ancienneBase = (await db.query("SELECT to_regclass('public.foods') IS NOT NULL AS oui")).rows[0].oui;
if (ancienneBase) {
    await db.query("ALTER TABLE recettes ADD COLUMN IF NOT EXISTS categorie TEXT NOT NULL DEFAULT 'plat'");
    await db.query("ALTER TABLE recettes ADD COLUMN IF NOT EXISTS etapes TEXT NOT NULL DEFAULT ''");

    await db.query("ALTER TABLE foods ADD COLUMN IF NOT EXISTS grammes_par_cuil_a_cafe NUMERIC");
    await db.query("ALTER TABLE foods ADD COLUMN IF NOT EXISTS grammes_par_cuil_a_soupe NUMERIC");

    await db.query("ALTER TABLE journal_repas ADD COLUMN IF NOT EXISTS ordre INTEGER");
    await db.query("ALTER TABLE journal_repas ADD COLUMN IF NOT EXISTS unite TEXT");
    await db.query("ALTER TABLE recette_ingredients ADD COLUMN IF NOT EXISTS unite TEXT");
    await db.query("ALTER TABLE journal_repas ADD COLUMN IF NOT EXISTS ajoute BOOLEAN NOT NULL DEFAULT false");

    await db.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS photo BYTEA");
    await db.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS date_achat TIMESTAMPTZ");
    await db.query("ALTER TABLE foods ADD COLUMN IF NOT EXISTS pas_achat INTEGER[]");
    await db.query(
        `UPDATE foods SET pas_achat = v.pas
         FROM (VALUES ('oeuf-moyen', '{10,20,30}'::int[]), ('pot-creme-vanille', '{1,2,8}'::int[]),
                      ('boeuf-hache-20', '{5,10,20}'::int[]), ('knacki-poulet', '{10,20,30}'::int[]),
                      ('yaourt', '{1,5,16}'::int[]), ('baguette-viennoise', '{6,12,18}'::int[])) AS v(id, pas)
         WHERE foods.id = v.id AND foods.pas_achat IS NULL`
    );
    await db.query(
        `UPDATE foods SET calories = 167, lipides = 9.6, graisses_saturees = 3.1, glucides = 11.9, sucres = 0.7, proteines = 8.4, sel = 2.1
         WHERE id = 'mortadelle' AND calories = 288`
    );
    await db.query(
        `INSERT INTO foods (id, nom, categorie, emoji, unite, poids_unite_g, calories, lipides, graisses_saturees, glucides, sucres,
           fibres, proteines, sel, emplacement, tracking_type, image)
         VALUES ('soupe-deshydratee', 'Soupe Déshydratée', 'Épicerie', '🥣', 'g', 0, 327, 2, 0.2, 66, 15, 5.4, 9.1, 8.8, 'st', 'unite',
                 'images/foods/soupe-deshydratee.webp')
         ON CONFLICT (id) DO UPDATE SET image = EXCLUDED.image WHERE foods.image IS NULL`
    );
    const yaourtEnNiveau = await db.query("SELECT 1 FROM foods WHERE id = 'yaourt' AND tracking_type = 'cl'");
    if (yaourtEnNiveau.rows.length) {
        await enTransaction(async (client) => {
            await client.query(
                `UPDATE stock SET unite = 'unités', quantite = CASE quantite
                    WHEN 'plein' THEN '16' WHEN 'à moitié' THEN '8' WHEN 'presque vide' THEN '3' ELSE '0' END
                 WHERE food_id = 'yaourt'`
            );
            await client.query("UPDATE foods SET tracking_type = 'unite' WHERE id = 'yaourt'");
        });
    }
    await db.query("ALTER TABLE courses ALTER COLUMN date_ajout SET DEFAULT CURRENT_DATE");
    await db.query(`
        UPDATE journal_repas SET ordre = sub.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY date_entree ORDER BY heure_entree) AS rn
            FROM journal_repas WHERE ordre IS NULL
        ) sub
        WHERE journal_repas.id = sub.id
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS courses_preset (
            id SERIAL PRIMARY KEY,
            food_id TEXT REFERENCES foods(id),
            nom_libre TEXT
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS tickets (
            id SERIAL PRIMARY KEY,
            date DATE,
            magasin TEXT NOT NULL,
            enseigne TEXT NOT NULL,
            total NUMERIC(10, 2) NOT NULL,
            UNIQUE (date, magasin)
        )
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS achats (
            id SERIAL PRIMARY KEY,
            ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
            rayon TEXT,
            libelle TEXT NOT NULL,
            quantite NUMERIC,
            poids NUMERIC,
            prix_unitaire NUMERIC(10, 2),
            total NUMERIC(10, 2) NOT NULL,
            contenance NUMERIC,
            unite TEXT,
            prix_ref NUMERIC(10, 2)
        )
    `);
    await db.query("CREATE INDEX IF NOT EXISTS achats_ticket_id ON achats (ticket_id)");
    // Une ligne par remise immédiate (offre, type, pourcentage, montant) pour suivre les promos dans le temps.
    await db.query(`
        CREATE TABLE IF NOT EXISTS promos (
            id SERIAL PRIMARY KEY,
            date DATE NOT NULL,
            magasin TEXT NOT NULL,
            produit TEXT NOT NULL,
            offre TEXT NOT NULL,
            type TEXT NOT NULL,
            pourcentage INTEGER,
            montant NUMERIC(10, 2) NOT NULL
        )
    `);
    await db.query("CREATE INDEX IF NOT EXISTS promos_date ON promos (date)");
    // Remise immédiate déduite (promo du ticket) ; achats.total est le prix réellement payé.
    await db.query("ALTER TABLE achats ADD COLUMN IF NOT EXISTS remise NUMERIC(10, 2) NOT NULL DEFAULT 0");
    await db.query("CREATE INDEX IF NOT EXISTS achats_libelle ON achats (libelle)");
    // Un libellé de ticket est associé une seule fois ; les achats suivants réutilisent l'association.
    await db.query(`
        CREATE TABLE IF NOT EXISTS libelles (
            libelle TEXT PRIMARY KEY,
            food_id TEXT REFERENCES foods(id),
            statut TEXT NOT NULL CHECK (statut IN ('chow', 'hors-chow', 'non-alimentaire', 'non-detaille', 'a-classer'))
        )
    `);

    // Indices INSEE par série (« alimentation », « ensemble ») ; remplace l'ancienne table à une seule série.
    await db.query("CREATE TABLE IF NOT EXISTS indices_france (serie TEXT NOT NULL, mois TEXT NOT NULL, valeur NUMERIC NOT NULL, PRIMARY KEY (serie, mois))");
    await db.query("DROP TABLE IF EXISTS indices_insee");
    await db.query("CREATE TABLE IF NOT EXISTS ip_bloquees (ip TEXT PRIMARY KEY, jusqua TIMESTAMPTZ NOT NULL)");

    // Les Paramètres (aliments, équivalences, prix) sont réservés à l'administrateur du foyer.
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS admin BOOLEAN NOT NULL DEFAULT false");
    await db.query(
        "UPDATE users SET admin = true WHERE email = 'oyinloye.mide@gmail.com' AND NOT EXISTS (SELECT 1 FROM users WHERE admin)"
    );

    // Coût d'un achat habituel, pour les aliments sans historique de tickets (prix moyens de supermarché, sauf le niébé).
    await db.query("ALTER TABLE foods ADD COLUMN IF NOT EXISTS prix_habituel NUMERIC(10, 2)");
    // Magasin où le foyer achète l'aliment, choisi ou appris en cochant en mode magasin ; sinon déduit des tickets.
    await db.query("ALTER TABLE foods ADD COLUMN IF NOT EXISTS magasin TEXT");
    await db.query(
        `UPDATE foods SET prix_habituel = v.prix
         FROM (VALUES ('haricots-niebe', 3.20), ('lentilles-vertes', 2.00), ('mortadelle', 2.50), ('sucre-morceaux', 1.60),
                      ('piment-poudre', 1.60), ('zeste-citron', 0.60), ('bouillon-boeuf', 1.50), ('panga', 4.50),
                      ('herbes-provence', 1.50), ('piment-marocain', 1.50), ('garri', 4.00)) AS v(id, prix)
         WHERE foods.id = v.id AND foods.prix_habituel IS NULL`
    );

    await db.query("ALTER TABLE courses DROP COLUMN IF EXISTS quantite");
    await db.query("ALTER TABLE courses DROP COLUMN IF EXISTS unite");
    await db.query("ALTER TABLE courses DROP COLUMN IF EXISTS magasin");
    await enTransaction((client) => client.query(fs.readFileSync(`db/migrations/${MIGRATION_DOMAINES}`, "utf8")));
}
// Migrations datées de db/migrations : chacune une fois, dans l'ordre des noms, enregistrée dans app.migrations.
await db.query("CREATE TABLE IF NOT EXISTS app.migrations (nom TEXT PRIMARY KEY, appliquee_le TIMESTAMPTZ NOT NULL DEFAULT now())");
await db.query("INSERT INTO app.migrations (nom) VALUES ($1) ON CONFLICT DO NOTHING", [MIGRATION_DOMAINES]);
const migrationsFaites = new Set((await db.query("SELECT nom FROM app.migrations")).rows.map((r) => r.nom));
for (const nom of fs.readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort()) {
    if (migrationsFaites.has(nom)) continue;
    await enTransaction(async (client) => {
        await client.query(fs.readFileSync(`db/migrations/${nom}`, "utf8"));
        await client.query("INSERT INTO app.migrations (nom) VALUES ($1)", [nom]);
    });
    console.log("Migration appliquée :", nom);
}
// Vues de calcul et description des tables, à jour à chaque démarrage.
await db.query(fs.readFileSync("db/vues.sql", "utf8"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(express.static("frontend/dist", { index: false }));
app.get(["/login", "/", "/stats", "/aliments", "/aliments/:idAliment", "/parametres", "/parametres/aliments", "/parametres/aliments/:idAliment",
    "/stock", "/courses", "/calories"], function (req, res) {
    res.sendFile("index.html", { root: "frontend/dist" });
});

app.use(express.json({ limit: "4mb" }));

const PgSession = connectPgSimple(session);

// Fly termine le HTTPS devant l'app : sans ça, le cookie "secure" ne serait jamais envoyé.
app.set("trust proxy", 1);

// Nettoyage des sessions expirées au démarrage seulement : toutes les 15 min, il réveillait Neon jour et nuit.
const sessionStore = new PgSession({
    pool: db,
    schemaName: "app",
    tableName: "sessions",
    createTableIfMissing: true,
    pruneSessionInterval: false,
});
sessionStore.pruneSessions();

app.use(session({
    store: sessionStore,
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30 * 12,
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    },
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
    { usernameField: "email" },
    async function verify(email, motDePasse, cb) {
        try {
            const result = await db.query("SELECT * FROM famille.comptes WHERE email = $1", [email]);
            if (result.rows.length === 0) {
                return cb(null, false);
            }
            const utilisateur = result.rows[0];
            const motDePasseValide = await bcrypt.compare(motDePasse, utilisateur.mot_de_passe);
            if (!motDePasseValide) {
                return cb(null, false);
            }
            return cb(null, utilisateur);
        } catch (err) {
            return cb(err);
        }
    }
));

passport.serializeUser(function (utilisateur, cb) {
    cb(null, utilisateur.id);
});

passport.deserializeUser(async function (id, cb) {
    try {
        const result = await db.query("SELECT * FROM famille.comptes WHERE id = $1", [id]);
        cb(null, result.rows[0]);
    } catch (err) {
        cb(err);
    }
});

// Les routes de connexion sont déclarées AVANT ce middleware pour rester accessibles sans être connecté.
function requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    if (req.path.startsWith("/api/")) {
        return res.status(401).json({ erreur: "Non connecté." });
    }
    res.redirect("/login");
}

// Écritures /api en JSON uniquement : un autre site ne peut pas en envoyer sans CORS (aucun n'est activé).
app.use("/api", function (req, res, next) {
    if (req.method === "POST" && !req.is("application/json")) {
        return res.status(415).json({ erreur: "Format JSON requis." });
    }
    next();
});

// Jamais le compte complet : il contient le hash du mot de passe.
function utilisateurPublic(utilisateur) {
    return { id: utilisateur.id, email: utilisateur.email, admin: utilisateur.admin === true };
}

// Limite des échecs de connexion. Les échecs se comptent en mémoire ; une adresse IP qui atteint la limite est
// bloquée 30 jours en base (survit aux redémarrages). Un email n'est verrouillé que 15 min, pour ne jamais
// bloquer un compte du foyer un mois. Débloquer : DELETE FROM app.ip_bloquees WHERE ip = '…'.
const BLOCAGE_IP = "30 days";
const FENETRE_ECHECS_MS = 15 * 60 * 1000;
const MAX_ECHECS = { ip: 5, email: 10 };
const echecsConnexion = new Map();

function cleEchecs(type, valeur) {
    return type + ":" + String(valeur || "").toLowerCase();
}

async function ipBloquee(ip) {
    const r = await db.query("SELECT 1 FROM app.ip_bloquees WHERE ip = $1 AND jusqua > NOW()", [ip]);
    return r.rows.length > 0;
}

function connexionBloquee(cles) {
    const maintenant = Date.now();
    return cles.some(([type, cle]) => {
        const e = echecsConnexion.get(cle);
        return e && maintenant - e.debut < FENETRE_ECHECS_MS && e.nombre >= MAX_ECHECS[type];
    });
}

function noterEchec(cles) {
    const maintenant = Date.now();
    for (const [, cle] of cles) {
        const e = echecsConnexion.get(cle);
        if (!e || maintenant - e.debut >= FENETRE_ECHECS_MS) echecsConnexion.set(cle, { nombre: 1, debut: maintenant });
        else e.nombre++;
    }
}

app.post("/api/login", async function (req, res, next) {
    const cles = [["ip", cleEchecs("ip", req.ip)], ["email", cleEchecs("email", req.body.email)]];
    try {
        if ((await ipBloquee(req.ip)) || connexionBloquee(cles)) {
            console.log("Connexion bloquée :", req.ip, req.body.email);
            return res.status(429).json({ erreur: "Trop d'essais. Connexion bloquée." });
        }
    } catch (err) {
        return next(err);
    }
    passport.authenticate("local", async function (err, utilisateur) {
        if (err) return next(err);
        if (!utilisateur) {
            noterEchec(cles);
            if (connexionBloquee(cles.slice(0, 1))) {
                await db.query(
                    `INSERT INTO app.ip_bloquees (ip, jusqua) VALUES ($1, NOW() + INTERVAL '${BLOCAGE_IP}')
                     ON CONFLICT (ip) DO UPDATE SET jusqua = EXCLUDED.jusqua`,
                    [req.ip]
                ).catch((e) => console.log("ERREUR blocage IP:", e.message));
                console.log("IP bloquée 30 jours :", req.ip);
            }
            return res.status(401).json({ erreur: "Email ou mot de passe incorrect." });
        }
        for (const [, cle] of cles) echecsConnexion.delete(cle);
        req.logIn(utilisateur, function (errLogin) {
            if (errLogin) return next(errLogin);
            res.json({ succes: true, utilisateur: utilisateurPublic(utilisateur) });
        });
    })(req, res, next);
});

app.post("/api/logout", function (req, res, next) {
    req.logout(function (err) {
        if (err) return next(err);
        res.json({ succes: true });
    });
});

app.get("/api/session", function (req, res) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ erreur: "Non connecté." });
    }
    res.json({ utilisateur: utilisateurPublic(req.user) });
});

// Tout ce qui est déclaré APRÈS cette ligne exige d'être connecté.
app.use(requireAuth);

function exigerAdmin(req, res, next) {
    if (req.user.admin) return next();
    res.status(403).json({ erreur: "Réservé à l'administrateur." });
}

const uniteParType = { unite: 'unités', pack: 'packs', cl: 'cl' };

async function chercherAliments() {
    const result = await db.query("SELECT * FROM chow.aliments");
    return result.rows
}

async function chercherStock() {
    const result = await db.query(
        `SELECT stock.*, aliments.nom, aliments.emoji, aliments.image, aliments.tracking_type, aliments.emplacement,
                EXISTS(
                    SELECT 1 FROM chow.courses
                    WHERE courses.food_id = stock.food_id AND courses.achete = false
                ) AS deja_en_courses
         FROM chow.stock JOIN chow.aliments ON stock.food_id = aliments.id`
    );
    const aujourdhui = new Date();
    result.rows.forEach(row => {
        const diff = aujourdhui - new Date(row.date_maj);
        row.jours_depuis = Math.floor(diff / (1000 * 60 * 60 * 24));
    });
    return result.rows
}

// Articles d'achat que Chow ne suit pas (shampoing, javel), avec leur famille (nom et identifiant de son icône) ; les fourre-tout sont exclus.
const ARTICLES_MAISON = `
    SELECT a.id, a.nom, a.suivi, f.nom AS famille, f.id AS famille_id
    FROM achats.articles a
    JOIN achats.categories c ON c.id = a.categorie_id
    JOIN achats.categories f ON f.id = COALESCE(c.parent_id, c.id)
    WHERE NOT a.fourre_tout AND NOT EXISTS (SELECT 1 FROM chow.aliments al WHERE al.article_id = a.id)`;

async function chercherCourses() {
    const result = await db.query(
        `SELECT courses.id, courses.food_id, courses.article_id, courses.nom_libre, courses.commentaire, courses.achete,
                courses.date_ajout,
                (courses.photo IS NOT NULL) AS has_photo,
                COALESCE(aliments.nom, articles.nom, courses.nom_libre) AS nom,
                CASE WHEN courses.article_id IS NULL THEN COALESCE(aliments.emoji, '🆕') END AS emoji, articles.famille_id,
                aliments.unite AS food_unite, COALESCE(aliments.categorie, articles.famille) AS categorie, aliments.pas_achat,
                -- Un article de la maison se compte comme un aliment à l'unité (nombre) ou au niveau (cl).
                COALESCE(aliments.tracking_type, CASE articles.suivi WHEN 'nombre' THEN 'unite' WHEN 'niveau' THEN 'cl' END) AS tracking_type,
                COALESCE(stock.quantite, inventaire.quantite::text, inventaire.niveau) AS quantite_stock,
                COALESCE(aliments.magasin, (
                    SELECT v.enseigne FROM chow.v_lignes_stats v
                    WHERE v.food_id = courses.food_id AND v.date >= CURRENT_DATE - INTERVAL '12 months'
                    GROUP BY v.enseigne ORDER BY count(DISTINCT v.ticket_id) DESC LIMIT 1
                )) AS magasin
         FROM chow.courses
         LEFT JOIN chow.aliments ON courses.food_id = aliments.id
         LEFT JOIN (${ARTICLES_MAISON}) articles ON articles.id = courses.article_id
         LEFT JOIN maison.inventaire ON inventaire.article_id = courses.article_id
         LEFT JOIN chow.stock ON stock.food_id = courses.food_id
         WHERE achete = false`
    );
    return result.rows
}

async function chercherRecettes() {
    const result = await db.query(`
        SELECT
            recettes.id,
            recettes.nom,
            recettes.categorie,
            recettes.etapes,
            COUNT(recette_ingredients.food_id) AS nb_ingredients,
            COALESCE(SUM(ROUND(aliments.calories * recette_ingredients.quantite_g / 100)), 0) AS kcal_total,
            COALESCE(
                ARRAY_AGG(recette_ingredients.food_id ORDER BY recette_ingredients.id) FILTER (WHERE recette_ingredients.food_id IS NOT NULL),
                '{}'
            ) AS food_ids,
            -- Émojis des ingrédients dans le même ordre que food_ids, pour l'icône composée de la carte recette
            COALESCE(
                ARRAY_AGG(aliments.emoji ORDER BY recette_ingredients.id) FILTER (WHERE recette_ingredients.food_id IS NOT NULL),
                '{}'
            ) AS emojis_ingredients
        FROM chow.recettes
        LEFT JOIN chow.recette_ingredients ON recette_ingredients.recette_id = recettes.id
        LEFT JOIN chow.aliments ON aliments.id = recette_ingredients.food_id
        GROUP BY recettes.id
        ORDER BY recettes.nom ASC
    `);
    return result.rows;
}

async function calculerTotauxRecette(idRecette) {
    const result = await db.query(
        `SELECT
            COUNT(recette_ingredients.food_id) AS nb_ingredients,
            COALESCE(SUM(ROUND(aliments.calories * recette_ingredients.quantite_g / 100)), 0) AS kcal_total
        FROM chow.recette_ingredients
        LEFT JOIN chow.aliments ON aliments.id = recette_ingredients.food_id
        WHERE recette_ingredients.recette_id = $1`,
        [idRecette]
    );
    return result.rows[0];
}

async function chercherJournalDuJour() {
    const result = await db.query(
        `SELECT journal.*, aliments.nom, aliments.emoji, aliments.categorie,
                aliments.grammes_par_cuil_a_cafe, aliments.grammes_par_cuil_a_soupe,
                aliments.poids_unite_g, aliments.unite AS unite_piece, aliments.tracking_type,
                ROUND(aliments.calories * journal.quantite_g / 100, 1) AS calories_calc,
                ROUND(aliments.glucides * journal.quantite_g / 100, 1) AS glucides_calc,
                ROUND(aliments.proteines * journal.quantite_g / 100, 1) AS proteines_calc,
                ROUND(aliments.lipides * journal.quantite_g / 100, 1) AS lipides_calc
         FROM chow.journal
         JOIN chow.aliments ON journal.food_id = aliments.id
         WHERE date_entree = CURRENT_DATE
         ORDER BY ordre ASC`
    );
    return result.rows;
}

async function chercherAliment(idAliment) {
    const result = await db.query("SELECT * FROM chow.aliments WHERE id = $1", [idAliment]);
    return result.rows[0];
}

async function chercherSuggestions() {
    const result = await db.query(
        `SELECT f.id AS food_id, f.nom, f.emoji, f.tracking_type, s.quantite,
                count(*) FILTER (WHERE c.date_achat >= NOW() - INTERVAL '30 days')::int AS achats_30j,
                count(*)::int AS achats_total,
                max(c.date_achat) AS dernier_achat
         FROM chow.courses c
         JOIN chow.aliments f ON f.id = c.food_id
         LEFT JOIN chow.stock s ON s.food_id = c.food_id
         WHERE c.achete = true
           AND NOT EXISTS (SELECT 1 FROM chow.courses p WHERE p.food_id = c.food_id AND p.achete = false)
         GROUP BY f.id, f.nom, f.emoji, f.tracking_type, s.quantite`
    );
    return result.rows;
}

async function chargerPageStock() {
    return { stock: await chercherStock(), aliments: await chercherAliments(), suggestions: await chercherSuggestions() };
}

async function chargerPageCourses() {
    const courses = await chercherCourses();
    const aliments = await chercherAliments();
    const stock = await chercherStock();
    const presetHebdo = await db.query("SELECT food_id, nom_libre FROM chow.courses_modeles");
    const articles = await db.query(`${ARTICLES_MAISON} ORDER BY a.nom`);
    return { courses, aliments, articles: articles.rows, stock, presetHebdo: presetHebdo.rows };
}

// Estimation des Courses sans saisir de quantité, article par article (prevoirArticle de stats.js) : quantité
// habituelle × dernier prix normal, dans le magasin choisi (mode magasin) ; fourchette tirée des écarts passés entre
// prévu et payé. Sans unité commune, repli sur la médiane et les quartiles du coût des 8 derniers passages.
const ENSEIGNES = ["Leclerc", "Carrefour", "Marché Frais"];

// Passages en caisse des 12 derniers mois, par aliment, du plus récent au plus ancien. Quantité d'un passage dans
// l'unité de prix : kg ou litre si la contenance est connue, sinon nombre d'articles.
async function passagesDesAliments(ids) {
    const historique = await db.query(
        `SELECT v.food_id, SUM(v.total)::float AS cout,
                SUM(v.quantite_ref)::float AS quantite_ref,
                SUM(COALESCE(v.quantite, 1))::float AS nombre,
                bool_and(v.contenance IS NOT NULL) AS au_poids,
                MAX(COALESCE(v.unite, 'u')) AS unite,
                v.enseigne, SUM(v.remise)::float AS remise
         FROM chow.v_lignes_stats v
         WHERE v.food_id = ANY($1) AND v.date >= CURRENT_DATE - INTERVAL '12 months'
         GROUP BY v.food_id, v.ticket_id, v.date, v.enseigne
         ORDER BY v.date DESC`,
        [ids]
    );
    const passagesParAliment = new Map();
    for (const ligne of historique.rows) {
        const passages = passagesParAliment.get(ligne.food_id) || [];
        // 20 passages : assez d'historique pour rejouer les prévisions passées (la quantité n'en garde que 8).
        if (passages.length < 20) passages.push(ligne);
        passagesParAliment.set(ligne.food_id, passages);
    }
    return passagesParAliment;
}

// Panier de la tournée en mode magasin : chaque article de la liste ou coché depuis le début de la tournée, avec son
// prix prévu (même calcul que l'estimation) et, s'il est au chariot, sa valeur (quantité prise × prix à la pièce
// quand il se compte, sinon le prix prévu). Les sommes par rayon et par magasin se font côté page.
async function chargerPanier() {
    const tournee = (await db.query("SELECT id, debut FROM chow.tournees WHERE fin IS NULL")).rows[0] || null;
    const lignes = (await db.query(
        `SELECT c.id, c.food_id, c.article_id, c.achete, c.enseigne, c.quantite_achetee::float AS quantite_achetee,
                COALESCE(a.nom, ar.nom, c.nom_libre) AS nom, a.categorie, a.prix_habituel::float AS prix_habituel, a.magasin
         FROM chow.courses c
         LEFT JOIN chow.aliments a ON a.id = c.food_id
         LEFT JOIN achats.articles ar ON ar.id = c.article_id
         WHERE c.achete = false OR ($1::timestamptz IS NOT NULL AND c.date_achat >= $1)`,
        [tournee?.debut ?? null]
    )).rows;
    const passages = await passagesDesAliments(lignes.filter((l) => l.food_id).map((l) => l.food_id));
    // Articles de la maison : prix payé sur les 8 dernières lignes de ticket.
    const maison = new Map((await db.query(
        `SELECT article_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY paye)::float AS prevu,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY paye / NULLIF(quantite, 0))::float AS piece
         FROM (SELECT article_id, paye, quantite, row_number() OVER (PARTITION BY article_id ORDER BY date DESC) AS rang
               FROM achats.v_lignes WHERE article_id = ANY($1)) d
         WHERE rang <= 8 GROUP BY article_id`,
        [lignes.filter((l) => l.article_id).map((l) => l.article_id)]
    )).rows.map((r) => [r.article_id, r]));
    const arrondi = (n) => (n == null ? null : Math.round(n * 100) / 100);
    return {
        tournee,
        lignes: lignes.map((l) => {
            let prevu = null, piece = null;
            if (l.food_id) {
                const p = passages.get(l.food_id);
                const prevision = p && prevoirArticle(p);
                if (prevision) {
                    prevu = prevision.estimation;
                    if (!p[0].au_poids) piece = prevision.prixUnitaire;
                } else if (p) prevu = quantile(p.slice(0, 8).map((x) => x.cout), 0.5);
                else prevu = l.prix_habituel;
            } else if (l.article_id) {
                prevu = maison.get(l.article_id)?.prevu ?? null;
                piece = maison.get(l.article_id)?.piece ?? null;
            }
            const valeur = l.achete ? (l.quantite_achetee && piece ? l.quantite_achetee * piece : prevu) : null;
            return {
                id: l.id, nom: l.nom, rayon: l.article_id ? "Maison" : l.categorie || "Autres", achete: l.achete,
                enseigne: l.enseigne, magasin: l.magasin, prevu: arrondi(prevu), valeur: arrondi(valeur),
            };
        }),
    };
}

async function estimerCourses(req) {
    const magasin = ENSEIGNES.includes(req?.query?.magasin) ? req.query.magasin : null;
    const articles = await db.query(
        `SELECT DISTINCT c.food_id, f.nom, f.emoji, f.prix_habituel
         FROM chow.courses c JOIN chow.aliments f ON f.id = c.food_id
         WHERE c.achete = false`
    );
    const libres = await db.query("SELECT count(*)::int AS n FROM chow.courses WHERE achete = false AND food_id IS NULL");
    const passagesParAliment = await passagesDesAliments(articles.rows.map((a) => a.food_id));

    let estimation = 0, bas = 0, haut = 0;
    const sansPrix = [];
    // Détail par article pour la bulle « comment c'est calculé » des Courses.
    const details = [];
    for (const article of articles.rows) {
        const passages = passagesParAliment.get(article.food_id);
        const prevu = passages && prevoirArticle(passages, magasin);
        if (prevu) {
            estimation += prevu.estimation;
            bas += prevu.bas;
            haut += prevu.haut;
            details.push({
                nom: article.nom, emoji: article.emoji, source: "habitudes", passages: passages.length,
                estimation: prevu.estimation, quantite: prevu.quantite,
                unite: passages[0].au_poids ? passages[0].unite : "pièce",
                dernierPrix: prevu.prixUnitaire, magasin: prevu.magasin, comparaisons: prevu.comparaisons,
            });
        } else if (passages) {
            // Unités qui ne se comparent pas (pièce puis kg…) : médiane et quartiles du coût des 8 derniers passages.
            const couts = passages.slice(0, 8).map((p) => p.cout);
            estimation += quantile(couts, 0.5);
            bas += quantile(couts, 0.25);
            haut += quantile(couts, 0.75);
            details.push({ nom: article.nom, emoji: article.emoji, source: "habitudes", passages: couts.length, estimation: Math.round(quantile(couts, 0.5) * 100) / 100 });
        } else if (article.prix_habituel !== null) {
            const prix = Number(article.prix_habituel);
            estimation += prix;
            bas += prix * 0.8;
            haut += prix * 1.2;
            details.push({ nom: article.nom, emoji: article.emoji, source: "prix-habituel", estimation: prix });
        } else {
            sansPrix.push(article.nom);
            details.push({ nom: article.nom, emoji: article.emoji, source: "sans-prix", estimation: null });
        }
    }
    return {
        estimation: Math.round(estimation),
        bas: Math.floor(bas),
        haut: Math.ceil(haut),
        articles: articles.rows.length + libres.rows[0].n,
        sansPrix: sansPrix.length + libres.rows[0].n,
        details: details.sort((a, b) => (b.estimation ?? -1) - (a.estimation ?? -1)),
    };
}

async function chargerPageCalories() {
    return { journal: await chercherJournalDuJour(), aliments: await chercherAliments(), recettes: await chercherRecettes() };
}

function lectureApi(charger) {
    return async function (req, res) {
        try {
            const donnees = await charger(req);
            if (!donnees) return res.status(404).json({ erreur: "Aliment introuvable." });
            res.json(donnees);
        } catch (err) {
            console.log("ERREUR:", err.message);
            res.status(500).json({ erreur: err.message });
        }
    };
}

app.get("/api/aliments", lectureApi(async () => ({ aliments: await chercherAliments() })));
app.get("/api/aliments/:idAliment", lectureApi(async (req) => {
    const aliment = await chercherAliment(req.params.idAliment);
    return aliment ? { aliment } : null;
}));
app.get("/api/stock", lectureApi(chargerPageStock));
app.get("/api/courses", lectureApi(chargerPageCourses));
app.get("/api/courses/estimation", lectureApi(estimerCourses));
app.get("/api/courses/panier", lectureApi(chargerPanier));

// Le mode magasin ouvre la tournée s'il n'y en a pas ; « Terminer » la ferme.
app.post("/api/courses/tournee/commencer", async (req, res) => {
    try {
        await db.query("INSERT INTO chow.tournees DEFAULT VALUES ON CONFLICT DO NOTHING");
        res.json({ succes: true, panier: await chargerPanier() });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/courses/tournee/terminer", async (req, res) => {
    try {
        await db.query("UPDATE chow.tournees SET fin = now() WHERE fin IS NULL");
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});
// Indices nationaux des prix (INSEE, IPC base 2025, ensemble des ménages, France) : alimentation (Coicop 01,
// produits alimentaires et boissons non alcoolisées) et ensemble (tous les produits). Récupérés au démarrage puis
// au plus une fois par jour ; l'INSEE publie avec environ un mois de décalage. En cas de panne réseau, les valeurs
// déjà en base restent utilisées.
const SERIES_INSEE = { alimentation: "011814667", ensemble: "011814630" };
let derniereMajInsee = 0;

async function majIndicesInsee() {
    if (Date.now() - derniereMajInsee < 24 * 60 * 60 * 1000) return;
    derniereMajInsee = Date.now();
    for (const [serie, idbank] of Object.entries(SERIES_INSEE)) {
        try {
            const reponse = await fetch(`https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/${idbank}?startPeriod=2023-01`, {
                signal: AbortSignal.timeout(15000),
            });
            if (!reponse.ok) throw new Error("INSEE " + reponse.status);
            const xml = await reponse.text();
            const valeurs = [...xml.matchAll(/TIME_PERIOD="(\d{4}-\d{2})" OBS_VALUE="([\d.]+)"/g)];
            for (const [, mois, valeur] of valeurs) {
                await db.query(
                    `INSERT INTO reference.indices_prix (serie, mois, valeur) VALUES ($1, $2, $3)
                     ON CONFLICT (serie, mois) DO UPDATE SET valeur = EXCLUDED.valeur`,
                    [serie, mois, valeur]
                );
            }
            console.log(`Indices INSEE (${serie}) à jour :`, valeurs.length, "mois");
        } catch (err) {
            console.log(`ERREUR indices INSEE (${serie}):`, err.message);
        }
    }
}
majIndicesInsee();

async function indicesNationaux() {
    majIndicesInsee();
    const result = await db.query("SELECT serie, mois, valeur::float FROM reference.indices_prix");
    const series = { alimentation: new Map(), ensemble: new Map() };
    for (const r of result.rows) series[r.serie]?.set(r.mois, r.valeur);
    return series;
}

// Toutes les lignes de tickets (quelques milliers) : la page Stats calcule ses agrégats en mémoire.
async function lignesTickets(foodId) {
    const result = await db.query(
        `SELECT v.jour, v.ticket_id, v.enseigne, v.libelle, v.total::float, v.quantite::float, v.poids::float,
                v.contenance::float, v.prix_ref::float, v.unite, v.remise::float, v.statut, v.food_id, f.nom, f.emoji, f.categorie
         FROM chow.v_lignes_stats v
         LEFT JOIN chow.aliments f ON f.id = v.food_id
         WHERE $1::text IS NULL OR v.food_id = $1`,
        [foodId ?? null]
    );
    return result.rows;
}

app.get("/api/stats", lectureApi(async (req) => {
    const { periode, ref, debut, fin, enseigne } = req.query;
    return calculerStats(await lignesTickets(), { periode, ref, debut, fin, enseigne }, jourIso(new Date()), await indicesNationaux());
}));
// Tickets d'un jour, d'une semaine ou d'un mois (Stats, icône ticket) : articles achetés, passages et économies.
async function lignesAchats(debut, fin, enseigne) {
    const result = await db.query(
        `SELECT v.ligne_id, v.ticket_id, v.date::text AS jour, v.enseigne, v.produit_id, v.article_id, v.article, v.fourre_tout,
                v.categorie_racine_id AS racine, al.emoji, ar.a_reduire, v.quantite::float, v.unite_vente, v.paye::float,
                v.quantite_ref::float, v.unite_ref, v.comparable, v.prix_ref_normal::float, v.prix_ref_paye::float
         FROM achats.v_lignes v
         LEFT JOIN achats.articles ar ON ar.id = v.article_id
         LEFT JOIN chow.aliments al ON al.id = v.aliment_id
         WHERE v.date >= $1 AND v.date < $2 AND ($3::text IS NULL OR v.enseigne = $3)`,
        [debut, fin, enseigne]
    );
    return result.rows;
}
const PERIODES_TICKETS = ["jour", "semaine", "mois", "dates"];
const JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;
app.get("/api/stats/tickets", lectureApi(async (req) => {
    const enseigne = req.query.enseigne && req.query.enseigne !== "tous" ? req.query.enseigne : null;
    const dates = JOUR_ISO.test(req.query.debut ?? "") && JOUR_ISO.test(req.query.fin ?? "") && req.query.debut <= req.query.fin;
    const periode = PERIODES_TICKETS.includes(req.query.periode) && (req.query.periode !== "dates" || dates) ? req.query.periode : "semaine";
    const jours = (await db.query(
        `SELECT DISTINCT t.date::text AS jour FROM achats.tickets t JOIN achats.magasins m ON m.id = t.magasin_id
         JOIN achats.enseignes e ON e.id = m.enseigne_id WHERE $1::text IS NULL OR e.nom = $1 ORDER BY 1`,
        [enseigne]
    )).rows.map((r) => r.jour);
    const aujourdhui = jourIso(new Date());
    const ref = /^\d{4}-\d{2}-\d{2}$/.test(req.query.ref ?? "") ? req.query.ref : jours.at(-1) ?? aujourdhui;
    const { debut, fin } = bornesTickets({ periode, ref, debut: req.query.debut, fin: req.query.fin }, aujourdhui);
    const ilYaUnAn = jourIso(new Date(Date.now() - 365 * 86400000));
    const tickets = (await db.query(
        `SELECT t.id, t.date::text AS jour, t.paye::float, m.nom AS magasin, e.nom AS enseigne
         FROM achats.tickets t JOIN achats.magasins m ON m.id = t.magasin_id JOIN achats.enseignes e ON e.id = m.enseigne_id
         WHERE t.date >= $1 AND t.date < $2 AND ($3::text IS NULL OR e.nom = $3) ORDER BY t.date DESC, t.id DESC`,
        [debut, fin, enseigne]
    )).rows;
    return detailTickets({
        lignes: await lignesAchats(debut, fin, enseigne),
        lignesAn: await lignesAchats(ilYaUnAn, jourIso(new Date(Date.now() + 86400000)), enseigne),
        tickets, jours, periode, ref, debut, fin, preferes: await articlesPreferes(),
    });
}));

async function articlesPreferes() {
    return new Set((await db.query("SELECT article_id FROM achats.choix WHERE decision = 'garder' AND preference IS NOT NULL")).rows.map((r) => r.article_id));
}
const lignesDouzeMois = () => lignesAchats(jourIso(new Date(Date.now() - 365 * 86400000)), jourIso(new Date(Date.now() + 86400000)), null);
const debutMois = (iso) => iso.slice(0, 7) + "-01";

// Liste d'un niveau d'économie (Tickets) : mettre un article dans « À arrêter » (1), « Desserts » (2), ou l'en sortir.
app.post("/api/articles/:idArticle/a-reduire", async (req, res) => {
    const niveau = req.body.niveau;
    if (![1, 2, null].includes(niveau)) return res.status(400).json({ erreur: "Niveau 1, 2 ou aucun." });
    try {
        const r = await db.query("UPDATE achats.articles SET a_reduire = $1 WHERE id = $2 AND NOT fourre_tout", [niveau, req.params.idArticle]);
        if (!r.rowCount) return res.status(404).json({ erreur: "Article introuvable." });
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

// Mon plan : habitudes de 12 mois et choix du foyer par article.
app.get("/api/plan", lectureApi(async () => {
    // Jetés du mois en cours et du précédent : ce qu'on achète en trop en ce moment.
    const moisDernier = new Date();
    moisDernier.setDate(1);
    moisDernier.setMonth(moisDernier.getMonth() - 1);
    return plan({
        lignesAn: await lignesDouzeMois(),
        choix: (await db.query("SELECT article_id, decision, quantite_visee, preference FROM achats.choix")).rows,
        jetes: (await db.query("SELECT article_id, quantite::float FROM chow.jetes WHERE mois >= $1", [jourIso(moisDernier)])).rows,
        aujourdhui: jourIso(new Date()),
    });
}));
const DECISIONS = ["garder", "moins", "arreter", "changer"];
app.post("/api/plan/:idArticle", async (req, res) => {
    const { decision, quantiteVisee } = req.body;
    if (decision !== null && !DECISIONS.includes(decision)) return res.status(400).json({ erreur: "Choix inconnu." });
    if (decision === "moins" && !(Number(quantiteVisee) >= 0)) return res.status(400).json({ erreur: "Quantité visée manquante." });
    try {
        if (decision === null) await db.query("DELETE FROM achats.choix WHERE article_id = $1", [req.params.idArticle]);
        else await db.query(
            `INSERT INTO achats.choix (article_id, decision, quantite_visee) VALUES ($1, $2, $3)
             ON CONFLICT (article_id) DO UPDATE SET decision = $2, quantite_visee = $3, modifie_le = now()`,
            [req.params.idArticle, decision, decision === "moins" ? Number(quantiteVisee) : null]
        );
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(err.code === "23503" ? 404 : 500).json({ erreur: err.code === "23503" ? "Article introuvable." : err.message });
    }
});

// Aliments jetés d'un mois (Paramètres) : les habituels, ceux déjà saisis, et la quantité à acheter en moins.
const JETES_HABITUELS = ["tomate", "mozzarella", "roquette", "feta", "corne-verte"];
app.get("/api/jetes", lectureApi(async (req) => {
    const mois = /^\d{4}-\d{2}$/.test(req.query.mois ?? "") ? req.query.mois + "-01" : debutMois(jourIso(new Date()));
    const hab = habitudes(await lignesDouzeMois(), jourIso(new Date()));
    const saisis = (await db.query("SELECT article_id, quantite::float, unite FROM chow.jetes WHERE mois = $1", [mois])).rows;
    const recents = (await db.query("SELECT DISTINCT article_id FROM chow.jetes WHERE mois >= $1::date - INTERVAL '6 months'", [mois])).rows.map((r) => r.article_id);
    const ids = [...new Set([...JETES_HABITUELS, ...recents, ...saisis.map((s) => s.article_id)])];
    const noms = new Map((await db.query("SELECT a.id, a.nom, al.emoji FROM achats.articles a LEFT JOIN chow.aliments al ON al.article_id = a.id WHERE a.id = ANY($1)", [ids])).rows.map((r) => [r.id, r]));
    const lignes = ids.filter((id) => noms.has(id)).map((id) => {
        const h = hab.get(id), s = saisis.find((x) => x.article_id === id);
        const unite = s?.unite ?? h?.unite ?? "piece";
        const quantite = s?.quantite ?? 0;
        return {
            id, nom: noms.get(id).nom, emoji: noms.get(id).emoji, unite, quantite, format: h?.format ?? null,
            prixUnite: h ? Math.round(h.prixUnite * 100) / 100 : null,
            montant: Math.round(quantite * (h?.prixUnite ?? 0) * 100) / 100,
            habitudeMois: h ? Math.round(h.quantiteMois * 10) / 10 : null,
        };
    });
    const autres = [...hab.values()].filter((h) => h.racine === "alimentation" && !ids.includes(h.id))
        .map((h) => ({ id: h.id, nom: h.nom, unite: h.unite })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    return { mois: mois.slice(0, 7), lignes, total: Math.round(lignes.reduce((s, l) => s + l.montant, 0) * 100) / 100, autres };
}));
app.post("/api/jetes", async (req, res) => {
    const { article, mois, quantite, unite } = req.body;
    if (!/^\d{4}-\d{2}$/.test(mois ?? "") || !["kg", "piece"].includes(unite) || !(Number(quantite) >= 0)) return res.status(400).json({ erreur: "Saisie invalide." });
    try {
        if (Number(quantite) === 0) await db.query("DELETE FROM chow.jetes WHERE article_id = $1 AND mois = $2", [article, mois + "-01"]);
        else await db.query(
            `INSERT INTO chow.jetes (article_id, mois, quantite, unite) VALUES ($1, $2, $3, $4)
             ON CONFLICT (article_id, mois) DO UPDATE SET quantite = $3, unite = $4, modifie_le = now()`,
            [article, mois + "-01", Number(quantite), unite]
        );
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(err.code === "23503" ? 404 : 500).json({ erreur: err.code === "23503" ? "Article introuvable." : err.message });
    }
});
app.get("/api/stats/produit/:idAliment", lectureApi(async (req) => {
    const fiche = ficheProduit((await lignesTickets(req.params.idAliment)).filter((l) => l.jour), jourIso(new Date()), req.query.periode ? req.query : null);
    return fiche ? { produit: fiche } : null;
}));

// Un aliment encore présent : niveau autre que « vide », ou nombre supérieur à 0.
const STOCK_NON_VIDE = "quantite IS NOT NULL AND quantite NOT IN ('vide', '0')";
app.get("/api/accueil", lectureApi(async () => {
    const resume = await db.query(
        `SELECT (SELECT count(*)::int FROM chow.stock WHERE ${STOCK_NON_VIDE}) AS stock,
                (SELECT count(*)::int FROM chow.stock WHERE ${STOCK_NON_VIDE} AND date_maj < CURRENT_DATE - 21) AS stock_a_verifier,
                (SELECT count(*)::int FROM chow.courses WHERE achete = false) AS courses,
                (SELECT COALESCE(SUM(paye), 0)::float FROM achats.tickets WHERE date >= date_trunc('month', CURRENT_DATE)) AS depense_mois,
                (SELECT COALESCE(SUM(paye), 0)::float FROM achats.tickets WHERE date >= date_trunc('week', CURRENT_DATE)) AS depense_semaine,
                (SELECT COALESCE(SUM(paye), 0)::float FROM achats.tickets
                 WHERE date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' AND date < date_trunc('month', CURRENT_DATE)) AS depense_mois_dernier`
    );
    const semaines = await db.query(
        `SELECT to_char(s.debut, 'YYYY-MM-DD') AS debut, COALESCE(SUM(t.paye), 0)::float AS total
         FROM generate_series(date_trunc('week', CURRENT_DATE) - INTERVAL '7 weeks', date_trunc('week', CURRENT_DATE), INTERVAL '1 week') AS s(debut)
         LEFT JOIN achats.tickets t ON t.date >= s.debut AND t.date < s.debut + INTERVAL '1 week'
         GROUP BY s.debut ORDER BY s.debut`
    );
    const aVerifier = await db.query(
        `SELECT stock.id, aliments.nom, aliments.emoji, stock.quantite, stock.unite, aliments.tracking_type, (CURRENT_DATE - stock.date_maj)::int AS jours
         FROM chow.stock JOIN chow.aliments ON aliments.id = stock.food_id
         WHERE ${STOCK_NON_VIDE.replaceAll("quantite", "stock.quantite")} AND stock.date_maj < CURRENT_DATE - 21
         ORDER BY stock.date_maj LIMIT 5`
    );
    return { ...resume.rows[0], semaines: semaines.rows, aVerifier: aVerifier.rows, estimation: await estimerCourses() };
}));
app.get("/api/calories", lectureApi(chargerPageCalories));

const sansAccents = (texte) => texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
app.post("/api/aliments", async (req, res) => {
    try {
        const nom = typeof req.body.nom === "string" ? req.body.nom.trim() : "";
        const nombre = (cle) => Number(req.body[cle]) || 0;
        const calories = Number(req.body.calories);
        if (!nom || !(calories >= 0) || req.body.calories === "" || req.body.calories === undefined) {
            return res.status(400).json({ erreur: "Nom et calories requis." });
        }
        const id = sansAccents(nom).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const existants = await db.query("SELECT id, nom FROM chow.aliments");
        const doublon = existants.rows.find((a) => a.id === id || sansAccents(a.nom) === sansAccents(nom));
        if (doublon) {
            return res.status(409).json({ erreur: "Cet aliment existe déjà.", idExistant: doublon.id });
        }
        const categorie = req.body.categorie || "Divers";
        // L'aliment a son article d'achat (même identifiant), pour y rattacher ses futurs tickets.
        const result = await enTransaction(async (client) => {
            await client.query(
                "INSERT INTO achats.articles (id, nom, categorie_id, unite_ref) VALUES ($1, $2, chow.categorie_achat($3), 'kg')",
                [id, nom, categorie]
            );
            return client.query(
                `INSERT INTO chow.aliments (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides,
                   fibres, sucres, graisses_saturees, sel, emplacement, tracking_type, article_id)
                 VALUES ($1, $2, $3, $4, 'g', 0, $5, $6, $7, $8, $9, $10, $11, $12, 'st', 'unite', $1)
                 RETURNING *`,
                [id, nom, categorie, req.body.emoji || "🆕", calories, nombre("proteines"), nombre("glucides"), nombre("lipides"),
                    nombre("fibres"), nombre("sucres"), nombre("graisses_saturees"), nombre("sel")]
            );
        });
        res.json({ succes: true, aliment: result.rows[0] });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/aliments/:idAliment/equivalences", exigerAdmin, async (req, res) => {
    try {
        const idAliment = req.params.idAliment;
        const grammesCafe = req.body.grammesCafe === "" ? null : req.body.grammesCafe;
        const grammesSoupe = req.body.grammesSoupe === "" ? null : req.body.grammesSoupe;

        const result = await db.query(
            `UPDATE chow.aliments
             SET grammes_par_cuil_a_cafe = $1, grammes_par_cuil_a_soupe = $2
             WHERE id = $3
             RETURNING grammes_par_cuil_a_cafe, grammes_par_cuil_a_soupe`,
            [grammesCafe, grammesSoupe, idAliment]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ erreur: "Aliment introuvable." });
        }

        res.json({ succes: true, equivalences: result.rows[0] });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/stock/ajouter", async (req, res) => {
    const idAliment = req.body.idAliment;
    const quantiteAliment = req.body.quantiteAliment;
    try {
        if (!idAliment || !quantiteAliment) {
            return res.status(400).json({ erreur: "Champs requis." });
        }
        const result = await db.query("SELECT tracking_type, nom, emplacement, emoji, image FROM chow.aliments WHERE id = $1", [idAliment]);
        if (result.rows.length === 0) {
            return res.status(400).json({ erreur: "Article introuvable." });
        }
        const tracking_type = result.rows[0].tracking_type;
        const nom = result.rows[0].nom;
        const emoji = result.rows[0].emoji;
        const image = result.rows[0].image;
        const unite = uniteParType[tracking_type];
        const emplacement = result.rows[0].emplacement;

        const existeDeja = await db.query("SELECT 1 FROM chow.stock WHERE food_id = $1", [idAliment]);
        if (existeDeja.rows.length > 0) {
            return res.status(400).json({ erreur: `L'article ${nom} est déjà dans le stock.` });
        }

        const insertResult = await db.query(
            "INSERT INTO chow.stock (food_id, quantite, unite, date_maj) VALUES ($1, $2, $3, NOW()) RETURNING id",
            [idAliment, quantiteAliment, unite]
        );

        res.json({
            succes: true,
            item: {
                id: insertResult.rows[0].id,
                food_id: idAliment,
                nom: nom,
                emoji: emoji,
                image: image,
                quantite: quantiteAliment,
                unite: unite,
                tracking_type: tracking_type,
                emplacement: emplacement,
                jours_depuis: 0
            }
        });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/stock/modifier", async (req, res) => {
    try {
        const nouvelleQuantite = req.body.nouvelleQuantite;
        const idStock = req.body.idStock;

        if (!nouvelleQuantite) {
            return res.status(400).json({ erreur: "Champs requis." });
        }

        // Toute modification compte comme une vérification : la date repart d'aujourd'hui.
        await db.query("UPDATE chow.stock SET quantite = $1, date_maj = CURRENT_DATE WHERE id = $2", [nouvelleQuantite, idStock]);
        res.json({ succes: true, quantite: nouvelleQuantite });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

// Vérification rapide depuis l'accueil : « toujours là » garde la quantité, « fini » vide l'article.
app.post("/api/stock/verifier", async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE chow.stock SET date_maj = CURRENT_DATE,
                    quantite = CASE WHEN $2 THEN (CASE WHEN aliments.tracking_type = 'cl' THEN 'vide' ELSE '0' END) ELSE stock.quantite END
             FROM chow.aliments WHERE aliments.id = stock.food_id AND stock.id = $1
             RETURNING stock.quantite`,
            [req.body.idStock, req.body.fini === true]
        );
        if (!result.rows.length) return res.status(404).json({ erreur: "Article introuvable." });
        res.json({ succes: true, quantite: result.rows[0].quantite });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/stock/supprimer", async (req, res) => {
    try {
        const idStock = req.body.idStock;
        if (!idStock) {
            return res.status(400).json({ erreur: "Aucune ligne sélectionnée" });
        }

        await db.query("DELETE FROM chow.stock WHERE id = $1", [idStock]);
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/courses/ajouter", async (req, res) => {
    const idAliment = req.body.idAliment || null;
    const idArticle = idAliment ? null : req.body.idArticle || null;
    const texteTape = req.body.rechercheAliment;
    try {
        if (!idAliment && !idArticle && !texteTape) {
            return res.status(400).json({ erreur: "Champs requis." });
        }

        const insertResult = await db.query(
            "INSERT INTO chow.courses (food_id, article_id, nom_libre) VALUES ($1, $2, $3) RETURNING id",
            [idAliment, idArticle, idAliment || idArticle ? null : texteTape]
        );
        const nouvelId = insertResult.rows[0].id;
        const courses = await chercherCourses();

        res.json({ succes: true, item: courses.find((c) => c.id === nouvelId), courses });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/courses/preset-hebdo", async (req, res) => {
    try {
        const presetResult = await db.query("SELECT food_id, nom_libre FROM chow.courses_modeles");

        const dejaLa = await db.query("SELECT food_id, nom_libre FROM chow.courses WHERE achete = false");
        const foodIdsDejaLa = new Set(dejaLa.rows.map(r => r.food_id).filter(Boolean));
        const nomsLibresDejaLa = new Set(
            dejaLa.rows.filter(r => !r.food_id && r.nom_libre).map(r => r.nom_libre.toLowerCase())
        );

        const nouveauxIds = [];

        for (const article of presetResult.rows) {
            if (article.food_id) {
                if (foodIdsDejaLa.has(article.food_id)) continue;
                const insertResult = await db.query(
                    "INSERT INTO chow.courses (food_id, nom_libre) VALUES ($1, NULL) RETURNING id",
                    [article.food_id]
                );
                nouveauxIds.push(insertResult.rows[0].id);
            } else {
                if (nomsLibresDejaLa.has(article.nom_libre.toLowerCase())) continue;
                const insertResult = await db.query(
                    "INSERT INTO chow.courses (food_id, nom_libre) VALUES (NULL, $1) RETURNING id",
                    [article.nom_libre]
                );
                nouveauxIds.push(insertResult.rows[0].id);
            }
        }

        if (nouveauxIds.length === 0) {
            return res.json({ succes: true, items: [], courses: await chercherCourses() });
        }

        const itemsResult = await db.query(
            `SELECT courses.*, COALESCE(aliments.nom, courses.nom_libre) AS nom, COALESCE(aliments.emoji, '🆕') AS emoji,
                    aliments.unite AS food_unite, aliments.tracking_type, aliments.categorie, aliments.pas_achat, stock.quantite AS quantite_stock
             FROM chow.courses
             LEFT JOIN chow.aliments ON courses.food_id = aliments.id
             LEFT JOIN chow.stock ON stock.food_id = courses.food_id
             WHERE courses.id = ANY($1)`,
            [nouveauxIds]
        );

        res.json({ succes: true, items: itemsResult.rows, courses: await chercherCourses() });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/courses/preset-hebdo/enregistrer", async (req, res) => {
    try {
        await enTransaction(async (client) => {
            await client.query("DELETE FROM chow.courses_modeles");

            const courant = await client.query("SELECT food_id, nom_libre FROM chow.courses WHERE achete = false");
            for (const article of courant.rows) {
                await client.query(
                    "INSERT INTO chow.courses_modeles (food_id, nom_libre) VALUES ($1, $2)",
                    [article.food_id, article.food_id ? null : article.nom_libre]
                );
            }
        });

        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/courses/commentaire", async (req, res) => {
    try {
        const idCourse = req.body.idCourse;
        const commentaire = req.body.commentaire;

        if (!idCourse) {
            return res.status(400).json({ erreur: "Aucun article sélectionné." });
        }

        await db.query("UPDATE chow.courses SET commentaire = $1 WHERE id = $2", [commentaire, idCourse]);
        res.json({ succes: true, courses: await chercherCourses() });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/courses/photo", async (req, res) => {
    try {
        const idCourse = req.body.idCourse;
        const photoBase64 = req.body.photo;

        if (!idCourse || !photoBase64) {
            return res.status(400).json({ erreur: "Photo ou article manquant." });
        }

        const buffer = Buffer.from(photoBase64, "base64");
        await db.query("UPDATE chow.courses SET photo = $1 WHERE id = $2", [buffer, idCourse]);
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/courses/photo/supprimer", async (req, res) => {
    try {
        const idCourse = req.body.idCourse;
        if (!idCourse) {
            return res.status(400).json({ erreur: "Aucun article sélectionné." });
        }
        await db.query("UPDATE chow.courses SET photo = NULL WHERE id = $1", [idCourse]);
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.get("/api/courses/:id/photo", async (req, res) => {
    try {
        const result = await db.query("SELECT photo FROM chow.courses WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0 || !result.rows[0].photo) {
            return res.status(404).send("Aucune photo.");
        }
        res.set("Content-Type", "image/jpeg");
        res.send(result.rows[0].photo);
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).send("Erreur serveur.");
    }
});

app.post("/api/courses/supprimer", async (req, res) => {
    try {
        const idCourse = req.body.idCourse;
        if (!idCourse) {
            return res.status(400).json({ erreur: "Aucune ligne sélectionnée" });
        }

        await db.query("DELETE FROM chow.courses WHERE id = $1", [idCourse]);
        res.json({ succes: true, courses: await chercherCourses() });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/courses/acheter", async (req, res) => {
    try {
        let quantiteEntiere = null;
        const idCourse = req.body.idCourse;
        const quantiteAchetee = req.body.quantiteAchetee;
        // Coché en mode magasin : l'aliment est désormais rattaché à ce magasin.
        const magasin = ENSEIGNES.includes(req.body.magasin) ? req.body.magasin : null;

        if (!idCourse) {
            return res.status(400).json({ erreur: "Aucun article sélectionné." });
        }

        const courseResult = await db.query(
            `SELECT courses.food_id, courses.article_id, articles.suivi
             FROM chow.courses LEFT JOIN achats.articles ON articles.id = courses.article_id
             WHERE courses.id = $1`,
            [idCourse]
        );
        if (courseResult.rows.length === 0) {
            return res.status(400).json({ erreur: "Article introuvable." });
        }
        const { food_id: foodId, article_id: articleId, suivi } = courseResult.rows[0];

        let trackingType = null;
        if (foodId) {
            const resultFood = await db.query("SELECT tracking_type FROM chow.aliments WHERE id = $1", [foodId]);
            trackingType = resultFood.rows[0].tracking_type;
        }
        if (foodId || suivi === "nombre") {
            if (trackingType !== 'cl') {
                quantiteEntiere = Math.round(Number(quantiteAchetee));
                if (!quantiteAchetee || !Number.isFinite(quantiteEntiere) || quantiteEntiere < 1) {
                    return res.status(400).json({ erreur: "Quantité invalide." });
                }
            }
        }

        await enTransaction(async (client) => {
            const achatResult = await client.query(
                `UPDATE chow.courses SET achete = true, photo = NULL, date_achat = NOW(), quantite_achetee = $2, enseigne = $3
                 WHERE id = $1 AND achete = false RETURNING id`,
                [idCourse, quantiteEntiere, magasin]
            );

            // Article de la maison : l'inventaire gagne les unités achetées, ou repasse à plein.
            if (achatResult.rows.length > 0 && articleId && suivi) {
                await client.query(
                    `INSERT INTO maison.inventaire (article_id, quantite, niveau) VALUES ($1, $2, $3)
                     ON CONFLICT (article_id) DO UPDATE SET
                        quantite = COALESCE(inventaire.quantite, 0) + EXCLUDED.quantite, niveau = EXCLUDED.niveau, date_maj = CURRENT_DATE`,
                    [articleId, suivi === "nombre" ? quantiteEntiere : null, suivi === "niveau" ? "plein" : null]
                );
            }
            if (achatResult.rows.length > 0 && foodId && magasin) {
                await client.query("UPDATE chow.aliments SET magasin = $2 WHERE id = $1", [foodId, magasin]);
            }
            if (achatResult.rows.length > 0 && foodId) {
                if (trackingType === 'cl') {
                    await client.query(
                        "INSERT INTO chow.stock (food_id, quantite, date_maj) VALUES ($1, 'plein', NOW()) ON CONFLICT (food_id) DO UPDATE SET quantite = 'plein', date_maj = NOW()",
                        [foodId]
                    );
                } else {
                    await client.query(
                        `INSERT INTO chow.stock (food_id, quantite, date_maj) VALUES ($1, $2, NOW())
                         ON CONFLICT (food_id) DO UPDATE SET
                            quantite = (
                                CASE WHEN stock.quantite ~ '^[0-9]+$' THEN stock.quantite::integer ELSE 0 END
                                + $2::integer
                            )::text,
                            date_maj = NOW()`,
                        [foodId, quantiteEntiere]
                    );
                }
            }
        });

        res.json({ succes: true, courses: await chercherCourses() });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/calories/ajouter", async (req, res) => {
    try {
        const idAliment = req.body.idAliment;
        const quantiteG = req.body.quantiteG || 100;

        if (!idAliment) {
            return res.status(400).json({ erreur: "Champs requis." });
        }

        const insertResult = await db.query(
            `INSERT INTO chow.journal (food_id, quantite_g, ordre)
             VALUES ($1, $2, COALESCE((SELECT MAX(ordre) FROM chow.journal WHERE date_entree = CURRENT_DATE), 0) + 1)
             RETURNING id`,
            [idAliment, quantiteG]
        );
        const nouvelId = insertResult.rows[0].id;

        const itemResult = await db.query(
            `SELECT journal.*, aliments.nom, aliments.emoji, aliments.categorie,
            aliments.grammes_par_cuil_a_cafe, aliments.grammes_par_cuil_a_soupe,
            aliments.poids_unite_g, aliments.unite AS unite_piece, aliments.tracking_type,
            ROUND(aliments.calories * journal.quantite_g / 100, 1) AS calories_calc,
            ROUND(aliments.glucides * journal.quantite_g / 100, 1) AS glucides_calc,
            ROUND(aliments.proteines * journal.quantite_g / 100, 1) AS proteines_calc,
            ROUND(aliments.lipides * journal.quantite_g / 100, 1) AS lipides_calc
     FROM chow.journal
     JOIN chow.aliments ON journal.food_id = aliments.id
     WHERE journal.id = $1`,
            [nouvelId]
        );
        res.json({ succes: true, item: itemResult.rows[0] });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

function uniteValide(unite) {
    return ["g", "cafe", "soupe", "piece", "ml", "l"].includes(unite) ? unite : null;
}

app.post("/api/calories/modifier", async (req, res) => {
    try {
        const idEntree = req.body.idEntree;
        const nouvelleQuantite = req.body.nouvelleQuantite;

        if (!idEntree || !nouvelleQuantite) {
            return res.status(400).json({ erreur: "Champs requis." });
        }

        await db.query(
            "UPDATE chow.journal SET quantite_g = $1, unite = COALESCE($3, unite) WHERE id = $2",
            [nouvelleQuantite, idEntree, uniteValide(req.body.unite)]
        );

        const itemResult = await db.query(
            `SELECT journal.*, aliments.nom, aliments.emoji,
                    ROUND(aliments.calories * journal.quantite_g / 100, 1) AS calories_calc,
                    ROUND(aliments.glucides * journal.quantite_g / 100, 1) AS glucides_calc,
                    ROUND(aliments.proteines * journal.quantite_g / 100, 1) AS proteines_calc,
                    ROUND(aliments.lipides * journal.quantite_g / 100, 1) AS lipides_calc
             FROM chow.journal
             JOIN chow.aliments ON journal.food_id = aliments.id
             WHERE journal.id = $1`,
            [idEntree]
        );

        res.json({ succes: true, item: itemResult.rows[0] });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/calories/supprimer", async (req, res) => {
    try {
        const idEntree = req.body.idEntree;
        if (!idEntree) {
            return res.status(400).json({ erreur: "Aucune ligne sélectionnée" });
        }

        await db.query("DELETE FROM chow.journal WHERE id = $1", [idEntree]);
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/calories/ajoute", async (req, res) => {
    try {
        const idEntree = req.body.idEntree;
        if (!idEntree || typeof req.body.ajoute !== "boolean") {
            return res.status(400).json({ erreur: "Requête invalide." });
        }
        const r = await db.query("UPDATE chow.journal SET ajoute = $1 WHERE id = $2 RETURNING id", [req.body.ajoute, idEntree]);
        if (r.rowCount === 0) return res.status(404).json({ erreur: "Entrée introuvable." });
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/calories/reordonner", async (req, res) => {
    try {
        const ids = req.body.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ erreur: "Requête invalide." });
        }
        await db.query(
            `UPDATE chow.journal j SET ordre = v.position
             FROM unnest($1::text[]) WITH ORDINALITY AS v(id, position)
             WHERE j.id::text = v.id AND j.date_entree = CURRENT_DATE`,
            [ids.map(String)]
        );
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/calories/vider", async (req, res) => {
    try {
        await db.query("DELETE FROM chow.journal WHERE date_entree = CURRENT_DATE");
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

async function remplacerCuisine(lignes) {
    return enTransaction(async (client) => {
        await client.query("DELETE FROM chow.journal WHERE date_entree = CURRENT_DATE");
        const nouvellesEntrees = [];
        let ordre = 1;
        for (const ligne of lignes) {
            const insertResult = await client.query(
                "INSERT INTO chow.journal (food_id, quantite_g, ordre, unite) VALUES ($1, $2, $3, $4) RETURNING id",
                [ligne.food_id, ligne.quantite_g, ordre, uniteValide(ligne.unite)]
            );
            nouvellesEntrees.push(insertResult.rows[0].id);
            ordre++;
        }
        const itemsResult = await client.query(`
            SELECT
                journal.*,
                aliments.nom,
                aliments.emoji,
                aliments.categorie,
                aliments.grammes_par_cuil_a_cafe,
                aliments.grammes_par_cuil_a_soupe,
                aliments.poids_unite_g,
                aliments.unite AS unite_piece,
                aliments.tracking_type,
                ROUND(aliments.calories * journal.quantite_g / 100, 1) AS calories_calc,
                ROUND(aliments.glucides * journal.quantite_g / 100, 1) AS glucides_calc,
                ROUND(aliments.proteines * journal.quantite_g / 100, 1) AS proteines_calc,
                ROUND(aliments.lipides * journal.quantite_g / 100, 1) AS lipides_calc
            FROM chow.journal
            JOIN chow.aliments
                ON journal.food_id = aliments.id
            WHERE journal.id = ANY($1)
            ORDER BY journal.ordre ASC
        `, [nouvellesEntrees]);
        return itemsResult.rows;
    });
}

app.post("/api/calories/ajouter-recette", async (req, res) => {
    try {
        const idRecette = req.body.idRecette;
        const facteur = req.body.facteur === undefined ? 1 : Number(req.body.facteur);

        if (!idRecette) {
            return res.status(400).json({
                erreur: "Aucune recette sélectionnée."
            });
        }
        if (!(facteur > 0 && facteur <= 20)) {
            return res.status(400).json({ erreur: "Facteur invalide." });
        }

        const ingredients = await db.query(
            "SELECT food_id, quantite_g, unite FROM chow.recette_ingredients WHERE recette_id = $1 ORDER BY id",
            [idRecette]
        );

        if (ingredients.rows.length === 0) {
            return res.status(400).json({
                erreur: "Cette recette n'a aucun ingrédient."
            });
        }

        const items = await remplacerCuisine(ingredients.rows.map((ing) => ({
            food_id: ing.food_id,
            quantite_g: Math.round(Number(ing.quantite_g) * facteur * 100) / 100,
            unite: ing.unite,
        })));
        res.json({ succes: true, items });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            erreur: err.message
        });
    }
});

app.post("/api/calories/ajouter-ingredients", async (req, res) => {
    try {
        const ingredients = req.body.ingredients;
        if (!Array.isArray(ingredients) || ingredients.length === 0) {
            return res.status(400).json({ erreur: "Aucun ingrédient." });
        }
        const lignes = ingredients.map((ing) => ({
            food_id: ing.food_id,
            quantite_g: Math.round(Number(ing.quantite_g) * 100) / 100,
            unite: ing.unite,
        }));
        if (lignes.some((l) => !l.food_id || !(l.quantite_g > 0))) {
            return res.status(400).json({ erreur: "Chaque ingrédient doit avoir un aliment et une quantité." });
        }
        const existants = await db.query("SELECT id FROM chow.aliments WHERE id = ANY($1)", [lignes.map((l) => String(l.food_id))]);
        if (existants.rows.length !== new Set(lignes.map((l) => String(l.food_id))).size) {
            return res.status(400).json({ erreur: "Aliment inconnu." });
        }
        res.json({ succes: true, items: await remplacerCuisine(lignes) });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/recettes/creer", async (req, res) => {
    try {
        const nom = req.body.nom;
        const categorie = req.body.categorie || "plat";
        const etapes = typeof req.body.etapes === "string" ? req.body.etapes.trim() : "";
        const ingredients = req.body.ingredients;

        if (!nom || !ingredients || ingredients.length === 0) {
            return res.status(400).json({ erreur: "Nom et au moins un ingrédient requis." });
        }

        // Recette et ingrédients ensemble : un ingrédient refusé n'en laisse pas une moitié en base.
        const idRecette = await enTransaction(async (client) => {
            const recetteResult = await client.query(
                "INSERT INTO chow.recettes (nom, categorie, etapes) VALUES ($1, $2, $3) RETURNING id",
                [nom, categorie, etapes]
            );
            const id = recetteResult.rows[0].id;
            for (const ingredient of ingredients) {
                await client.query(
                    "INSERT INTO chow.recette_ingredients (recette_id, food_id, quantite_g, unite) VALUES ($1, $2, $3, $4)",
                    [id, ingredient.food_id, ingredient.quantite_g, uniteValide(ingredient.unite)]
                );
            }
            return id;
        });

        const totaux = await calculerTotauxRecette(idRecette);
        res.json({ succes: true, recette: { id: idRecette, nom: nom, categorie: categorie, etapes: etapes, nb_ingredients: totaux.nb_ingredients, kcal_total: totaux.kcal_total } });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.get("/api/recettes/:id", async (req, res) => {
    try {
        const idRecette = req.params.id;

        const recetteResult = await db.query(
            "SELECT id, nom, categorie, etapes FROM chow.recettes WHERE id = $1",
            [idRecette]
        );
        if (recetteResult.rows.length === 0) {
            return res.status(404).json({ erreur: "Recette introuvable." });
        }

        const ingredientsResult = await db.query(
            `SELECT aliments.id AS food_id, aliments.nom, aliments.emoji, recette_ingredients.quantite_g, recette_ingredients.unite,
                    aliments.grammes_par_cuil_a_cafe, aliments.grammes_par_cuil_a_soupe,
                    aliments.poids_unite_g, aliments.unite AS unite_piece, aliments.tracking_type
             FROM chow.recette_ingredients
             JOIN chow.aliments ON aliments.id = recette_ingredients.food_id
             WHERE recette_ingredients.recette_id = $1
             ORDER BY recette_ingredients.id`,
            [idRecette]
        );

        res.json({
            succes: true,
            recette: recetteResult.rows[0],
            ingredients: ingredientsResult.rows
        });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/recettes/:id/modifier", async (req, res) => {
    try {
        const idRecette = req.params.id;
        const nom = req.body.nom;
        const categorie = req.body.categorie || "plat";
        const etapes = typeof req.body.etapes === "string" ? req.body.etapes.trim() : "";
        const ingredients = req.body.ingredients;

        if (!nom || !ingredients || ingredients.length === 0) {
            return res.status(400).json({ erreur: "Nom et au moins un ingrédient requis." });
        }

        await enTransaction(async (client) => {
            await client.query(
                "UPDATE chow.recettes SET nom = $1, categorie = $2, etapes = $3 WHERE id = $4",
                [nom, categorie, etapes, idRecette]
            );

            await client.query("DELETE FROM chow.recette_ingredients WHERE recette_id = $1", [idRecette]);

            for (const ingredient of ingredients) {
                await client.query(
                    "INSERT INTO chow.recette_ingredients (recette_id, food_id, quantite_g, unite) VALUES ($1, $2, $3, $4)",
                    [idRecette, ingredient.food_id, ingredient.quantite_g, uniteValide(ingredient.unite)]
                );
            }
        });

        const totaux = await calculerTotauxRecette(idRecette);
        res.json({ succes: true, recette: { etapes: etapes, nb_ingredients: totaux.nb_ingredients, kcal_total: totaux.kcal_total } });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/recettes/:id/supprimer", async (req, res) => {
    try {
        const idRecette = req.params.id;

        await enTransaction(async (client) => {
            await client.query("DELETE FROM chow.recette_ingredients WHERE recette_id = $1", [idRecette]);
            await client.query("DELETE FROM chow.recettes WHERE id = $1", [idRecette]);
        });

        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/recettes/depuis-journal", async (req, res) => {
    try {
        const nom = req.body.nom;
        const categorie = req.body.categorie || "plat";

        if (!nom) {
            return res.status(400).json({ erreur: "Nom requis." });
        }

        const journalResult = await db.query(
            "SELECT food_id, quantite_g FROM chow.journal WHERE date_entree = CURRENT_DATE"
        );

        if (journalResult.rows.length === 0) {
            return res.status(400).json({ erreur: "La cuisine du jour est vide." });
        }

        const recetteResult = await db.query(
            "INSERT INTO chow.recettes (nom, categorie) VALUES ($1, $2) RETURNING id",
            [nom, categorie]
        );
        const idRecette = recetteResult.rows[0].id;

        for (const entree of journalResult.rows) {
            await db.query(
                "INSERT INTO chow.recette_ingredients (recette_id, food_id, quantite_g) VALUES ($1, $2, $3)",
                [idRecette, entree.food_id, entree.quantite_g]
            );
        }

        res.json({ succes: true, recette: { id: idRecette, nom: nom, categorie: categorie } });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.use("/api", function (req, res) {
    res.status(404).json({ erreur: "Route inconnue." });
});

app.listen(port, () => {
    console.log(`API is running at http://localhost:${port}`);
});
