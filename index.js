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
    await enTransaction((client) => client.query(fs.readFileSync("db/migrations/2026-10-30-schemas-par-domaine.sql", "utf8")));
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

async function chercherCourses() {
    const result = await db.query(
        `SELECT courses.id, courses.food_id, courses.nom_libre, courses.commentaire, courses.achete,
                courses.date_ajout,
                (courses.photo IS NOT NULL) AS has_photo,
                COALESCE(aliments.nom, courses.nom_libre) AS nom, COALESCE(aliments.emoji, '🆕') AS emoji,
                aliments.unite AS food_unite, aliments.tracking_type, aliments.categorie, aliments.pas_achat, stock.quantite AS quantite_stock,
                COALESCE(aliments.magasin, (
                    SELECT v.enseigne FROM chow.v_lignes_stats v
                    WHERE v.food_id = courses.food_id AND v.date >= CURRENT_DATE - INTERVAL '12 months'
                    GROUP BY v.enseigne ORDER BY count(DISTINCT v.ticket_id) DESC LIMIT 1
                )) AS magasin
         FROM chow.courses
         LEFT JOIN chow.aliments ON courses.food_id = aliments.id
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
    return { courses, aliments, stock, presetHebdo: presetHebdo.rows };
}

// Estimation des Courses sans saisir de quantité, article par article (prevoirArticle de stats.js) : quantité
// habituelle × dernier prix normal, dans le magasin choisi (mode magasin) ; fourchette tirée des écarts passés entre
// prévu et payé. Sans unité commune, repli sur la médiane et les quartiles du coût des 8 derniers passages.
const ENSEIGNES = ["Leclerc", "Carrefour", "Marché Frais"];

async function estimerCourses(req) {
    const magasin = ENSEIGNES.includes(req?.query?.magasin) ? req.query.magasin : null;
    const articles = await db.query(
        `SELECT DISTINCT c.food_id, f.nom, f.emoji, f.prix_habituel
         FROM chow.courses c JOIN chow.aliments f ON f.id = c.food_id
         WHERE c.achete = false`
    );
    const libres = await db.query("SELECT count(*)::int AS n FROM chow.courses WHERE achete = false AND food_id IS NULL");
    // Quantité d'un passage dans l'unité de prix : kg ou litre si la contenance est connue, sinon nombre d'articles.
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
        [articles.rows.map((a) => a.food_id)]
    );
    const passagesParAliment = new Map();
    for (const ligne of historique.rows) {
        const passages = passagesParAliment.get(ligne.food_id) || [];
        // 20 passages : assez d'historique pour rejouer les prévisions passées (la quantité n'en garde que 8).
        if (passages.length < 20) passages.push(ligne);
        passagesParAliment.set(ligne.food_id, passages);
    }

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
        const result = await db.query(
            `INSERT INTO chow.aliments (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides,
               fibres, sucres, graisses_saturees, sel, emplacement, tracking_type)
             VALUES ($1, $2, $3, $4, 'g', 0, $5, $6, $7, $8, $9, $10, $11, $12, 'st', 'unite')
             RETURNING *`,
            [id, nom, req.body.categorie || "Divers", req.body.emoji || "🆕", calories, nombre("proteines"), nombre("glucides"), nombre("lipides"),
                nombre("fibres"), nombre("sucres"), nombre("graisses_saturees"), nombre("sel")]
        );
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
    const texteTape = req.body.rechercheAliment;
    try {
        if (!idAliment && !texteTape) {
            return res.status(400).json({ erreur: "Champs requis." });
        }

        const insertResult = await db.query(
            "INSERT INTO chow.courses (food_id, nom_libre) VALUES ($1, $2) RETURNING id",
            [idAliment || null, idAliment ? null : texteTape]
        );
        const nouvelId = insertResult.rows[0].id;

        const itemResult = await db.query(
            `SELECT courses.*, COALESCE(aliments.nom, courses.nom_libre) AS nom, COALESCE(aliments.emoji, '🆕') AS emoji,
                    aliments.unite AS food_unite, aliments.tracking_type, aliments.categorie, aliments.pas_achat, stock.quantite AS quantite_stock
             FROM chow.courses
             LEFT JOIN chow.aliments ON courses.food_id = aliments.id
             LEFT JOIN chow.stock ON stock.food_id = courses.food_id
             WHERE courses.id = $1`,
            [nouvelId]
        );

        res.json({ succes: true, item: itemResult.rows[0], courses: await chercherCourses() });
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

        const courseResult = await db.query("SELECT food_id FROM chow.courses WHERE id = $1", [idCourse]);
        if (courseResult.rows.length === 0) {
            return res.status(400).json({ erreur: "Article introuvable." });
        }
        const foodId = courseResult.rows[0].food_id;

        let trackingType = null;
        if (foodId) {
            const resultFood = await db.query("SELECT tracking_type FROM chow.aliments WHERE id = $1", [foodId]);
            trackingType = resultFood.rows[0].tracking_type;
            if (trackingType !== 'cl') {
                quantiteEntiere = Math.round(Number(quantiteAchetee));
                if (!quantiteAchetee || !Number.isFinite(quantiteEntiere) || quantiteEntiere < 1) {
                    return res.status(400).json({ erreur: "Quantité invalide." });
                }
            }
        }

        await enTransaction(async (client) => {
            const achatResult = await client.query(
                "UPDATE chow.courses SET achete = true, photo = NULL, date_achat = NOW() WHERE id = $1 AND achete = false RETURNING id",
                [idCourse]
            );

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

        const recetteResult = await db.query(
            "INSERT INTO chow.recettes (nom, categorie, etapes) VALUES ($1, $2, $3) RETURNING id",
            [nom, categorie, etapes]
        );
        const idRecette = recetteResult.rows[0].id;

        for (const ingredient of ingredients) {
            await db.query(
                "INSERT INTO chow.recette_ingredients (recette_id, food_id, quantite_g, unite) VALUES ($1, $2, $3, $4)",
                [idRecette, ingredient.food_id, ingredient.quantite_g, uniteValide(ingredient.unite)]
            );
        }

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
