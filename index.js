import express from "express";
import pg from "pg";
import "dotenv/config";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

const app = express();

const port = process.env.PORT || 3000;

const db = new pg.Client(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
        }
);

await db.connect();

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
const yaourtEnNiveau = await db.query("SELECT 1 FROM foods WHERE id = 'yaourt' AND tracking_type = 'cl'");
if (yaourtEnNiveau.rows.length) {
    await db.query("BEGIN");
    await db.query(
        `UPDATE stock SET unite = 'unités', quantite = CASE quantite
            WHEN 'plein' THEN '16' WHEN 'à moitié' THEN '8' WHEN 'presque vide' THEN '3' ELSE '0' END
         WHERE food_id = 'yaourt'`
    );
    await db.query("UPDATE foods SET tracking_type = 'unite' WHERE id = 'yaourt'");
    await db.query("COMMIT");
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

await db.query("ALTER TABLE courses DROP COLUMN IF EXISTS quantite");
await db.query("ALTER TABLE courses DROP COLUMN IF EXISTS unite");
await db.query("ALTER TABLE courses DROP COLUMN IF EXISTS magasin");

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(express.static("frontend/dist", { index: false }));
app.get(["/login", "/", "/aliments", "/aliments/:idAliment", "/stock", "/courses", "/calories"], function (req, res) {
    res.sendFile("index.html", { root: "frontend/dist" });
});

app.use(express.json({ limit: "4mb" }));

const PgSession = connectPgSimple(session);

// Fly termine le HTTPS devant l'app : sans ça, le cookie "secure" ne serait jamais envoyé.
app.set("trust proxy", 1);

app.use(session({
    store: new PgSession({
        conObject: process.env.DATABASE_URL
            ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
            : {
                user: process.env.DB_USER,
                host: process.env.DB_HOST,
                database: process.env.DB_NAME,
                password: process.env.DB_PASSWORD,
                port: process.env.DB_PORT,
            },
        createTableIfMissing: true,
    }),
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
            const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
            if (result.rows.length === 0) {
                return cb(null, false);
            }
            const utilisateur = result.rows[0];
            const motDePasseValide = await bcrypt.compare(motDePasse, utilisateur.password);
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
        const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
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

// Jamais l'objet "users" complet : il contient le hash du mot de passe.
function utilisateurPublic(utilisateur) {
    return { id: utilisateur.id, email: utilisateur.email };
}

app.post("/api/login", function (req, res, next) {
    passport.authenticate("local", function (err, utilisateur) {
        if (err) return next(err);
        if (!utilisateur) {
            return res.status(401).json({ erreur: "Email ou mot de passe incorrect." });
        }
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

const uniteParType = { unite: 'unités', pack: 'packs', cl: 'cl' };

async function chercherAliments() {
    const result = await db.query("SELECT * FROM foods");
    return result.rows
}

async function chercherStock() {
    const result = await db.query(
        `SELECT stock.*, foods.nom, foods.emoji, foods.image, foods.tracking_type, foods.emplacement,
                EXISTS(
                    SELECT 1 FROM courses
                    WHERE courses.food_id = stock.food_id AND courses.achete = false
                ) AS deja_en_courses
         FROM stock JOIN foods ON stock.food_id = foods.id`
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
                COALESCE(foods.nom, courses.nom_libre) AS nom, COALESCE(foods.emoji, '🆕') AS emoji,
                foods.unite AS food_unite, foods.tracking_type, foods.categorie, foods.pas_achat, stock.quantite AS quantite_stock
         FROM courses
         LEFT JOIN foods ON courses.food_id = foods.id
         LEFT JOIN stock ON stock.food_id = courses.food_id
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
            COALESCE(SUM(ROUND(foods.calories * recette_ingredients.quantite_g / 100)), 0) AS kcal_total,
            COALESCE(
                ARRAY_AGG(recette_ingredients.food_id ORDER BY recette_ingredients.id) FILTER (WHERE recette_ingredients.food_id IS NOT NULL),
                '{}'
            ) AS food_ids,
            -- Émojis des ingrédients dans le même ordre que food_ids, pour l'icône composée de la carte recette
            COALESCE(
                ARRAY_AGG(foods.emoji ORDER BY recette_ingredients.id) FILTER (WHERE recette_ingredients.food_id IS NOT NULL),
                '{}'
            ) AS emojis_ingredients
        FROM recettes
        LEFT JOIN recette_ingredients ON recette_ingredients.recette_id = recettes.id
        LEFT JOIN foods ON foods.id = recette_ingredients.food_id
        GROUP BY recettes.id
        ORDER BY recettes.nom ASC
    `);
    return result.rows;
}

async function calculerTotauxRecette(idRecette) {
    const result = await db.query(
        `SELECT
            COUNT(recette_ingredients.food_id) AS nb_ingredients,
            COALESCE(SUM(ROUND(foods.calories * recette_ingredients.quantite_g / 100)), 0) AS kcal_total
        FROM recette_ingredients
        LEFT JOIN foods ON foods.id = recette_ingredients.food_id
        WHERE recette_ingredients.recette_id = $1`,
        [idRecette]
    );
    return result.rows[0];
}

async function chercherJournalDuJour() {
    const result = await db.query(
        `SELECT journal_repas.*, foods.nom, foods.emoji, foods.categorie,
                foods.grammes_par_cuil_a_cafe, foods.grammes_par_cuil_a_soupe,
                foods.poids_unite_g, foods.unite AS unite_piece, foods.tracking_type,
                ROUND(foods.calories * journal_repas.quantite_g / 100, 1) AS calories_calc,
                ROUND(foods.glucides * journal_repas.quantite_g / 100, 1) AS glucides_calc,
                ROUND(foods.proteines * journal_repas.quantite_g / 100, 1) AS proteines_calc,
                ROUND(foods.lipides * journal_repas.quantite_g / 100, 1) AS lipides_calc
         FROM journal_repas
         JOIN foods ON journal_repas.food_id = foods.id
         WHERE date_entree = CURRENT_DATE
         ORDER BY ordre ASC`
    );
    return result.rows;
}

async function chercherAliment(idAliment) {
    const result = await db.query("SELECT * FROM foods WHERE id = $1", [idAliment]);
    return result.rows[0];
}

async function chercherSuggestions() {
    const result = await db.query(
        `SELECT f.id AS food_id, f.nom, f.emoji, f.tracking_type, s.quantite,
                count(*) FILTER (WHERE c.date_achat >= NOW() - INTERVAL '30 days')::int AS achats_30j,
                count(*)::int AS achats_total,
                max(c.date_achat) AS dernier_achat
         FROM courses c
         JOIN foods f ON f.id = c.food_id
         LEFT JOIN stock s ON s.food_id = c.food_id
         WHERE c.achete = true
           AND NOT EXISTS (SELECT 1 FROM courses p WHERE p.food_id = c.food_id AND p.achete = false)
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
    const presetHebdo = await db.query("SELECT food_id, nom_libre FROM courses_preset");
    return { courses, aliments, stock, presetHebdo: presetHebdo.rows };
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
        const existants = await db.query("SELECT id, nom FROM foods");
        const doublon = existants.rows.find((a) => a.id === id || sansAccents(a.nom) === sansAccents(nom));
        if (doublon) {
            return res.status(409).json({ erreur: "Cet aliment existe déjà.", idExistant: doublon.id });
        }
        const result = await db.query(
            `INSERT INTO foods (id, nom, categorie, emoji, unite, poids_unite_g, calories, proteines, glucides, lipides,
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

app.post("/api/aliments/:idAliment/equivalences", async (req, res) => {
    try {
        const idAliment = req.params.idAliment;
        const grammesCafe = req.body.grammesCafe === "" ? null : req.body.grammesCafe;
        const grammesSoupe = req.body.grammesSoupe === "" ? null : req.body.grammesSoupe;

        const result = await db.query(
            `UPDATE foods
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
        const result = await db.query("SELECT tracking_type, nom, emplacement, emoji, image FROM foods WHERE id = $1", [idAliment]);
        if (result.rows.length === 0) {
            return res.status(400).json({ erreur: "Article introuvable." });
        }
        const tracking_type = result.rows[0].tracking_type;
        const nom = result.rows[0].nom;
        const emoji = result.rows[0].emoji;
        const image = result.rows[0].image;
        const unite = uniteParType[tracking_type];
        const emplacement = result.rows[0].emplacement;

        const existeDeja = await db.query("SELECT 1 FROM stock WHERE food_id = $1", [idAliment]);
        if (existeDeja.rows.length > 0) {
            return res.status(400).json({ erreur: `L'article ${nom} est déjà dans le stock.` });
        }

        const insertResult = await db.query(
            "INSERT INTO stock (food_id, quantite, unite, date_maj) VALUES ($1, $2, $3, NOW()) RETURNING id",
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

        await db.query("UPDATE stock SET quantite = $1 WHERE id = $2", [nouvelleQuantite, idStock]);
        res.json({ succes: true, quantite: nouvelleQuantite });
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

        await db.query("DELETE FROM stock WHERE id = $1", [idStock]);
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
            "INSERT INTO courses (food_id, nom_libre) VALUES ($1, $2) RETURNING id",
            [idAliment || null, idAliment ? null : texteTape]
        );
        const nouvelId = insertResult.rows[0].id;

        const itemResult = await db.query(
            `SELECT courses.*, COALESCE(foods.nom, courses.nom_libre) AS nom, COALESCE(foods.emoji, '🆕') AS emoji,
                    foods.unite AS food_unite, foods.tracking_type, foods.categorie, foods.pas_achat, stock.quantite AS quantite_stock
             FROM courses
             LEFT JOIN foods ON courses.food_id = foods.id
             LEFT JOIN stock ON stock.food_id = courses.food_id
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
        const presetResult = await db.query("SELECT food_id, nom_libre FROM courses_preset");

        const dejaLa = await db.query("SELECT food_id, nom_libre FROM courses WHERE achete = false");
        const foodIdsDejaLa = new Set(dejaLa.rows.map(r => r.food_id).filter(Boolean));
        const nomsLibresDejaLa = new Set(
            dejaLa.rows.filter(r => !r.food_id && r.nom_libre).map(r => r.nom_libre.toLowerCase())
        );

        const nouveauxIds = [];

        for (const article of presetResult.rows) {
            if (article.food_id) {
                if (foodIdsDejaLa.has(article.food_id)) continue;
                const insertResult = await db.query(
                    "INSERT INTO courses (food_id, nom_libre) VALUES ($1, NULL) RETURNING id",
                    [article.food_id]
                );
                nouveauxIds.push(insertResult.rows[0].id);
            } else {
                if (nomsLibresDejaLa.has(article.nom_libre.toLowerCase())) continue;
                const insertResult = await db.query(
                    "INSERT INTO courses (food_id, nom_libre) VALUES (NULL, $1) RETURNING id",
                    [article.nom_libre]
                );
                nouveauxIds.push(insertResult.rows[0].id);
            }
        }

        if (nouveauxIds.length === 0) {
            return res.json({ succes: true, items: [], courses: await chercherCourses() });
        }

        const itemsResult = await db.query(
            `SELECT courses.*, COALESCE(foods.nom, courses.nom_libre) AS nom, COALESCE(foods.emoji, '🆕') AS emoji,
                    foods.unite AS food_unite, foods.tracking_type, foods.categorie, foods.pas_achat, stock.quantite AS quantite_stock
             FROM courses
             LEFT JOIN foods ON courses.food_id = foods.id
             LEFT JOIN stock ON stock.food_id = courses.food_id
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
    let transactionStarted = false;
    try {
        await db.query("BEGIN");
        transactionStarted = true;

        await db.query("DELETE FROM courses_preset");

        const courant = await db.query("SELECT food_id, nom_libre FROM courses WHERE achete = false");
        for (const article of courant.rows) {
            await db.query(
                "INSERT INTO courses_preset (food_id, nom_libre) VALUES ($1, $2)",
                [article.food_id, article.food_id ? null : article.nom_libre]
            );
        }

        await db.query("COMMIT");
        transactionStarted = false;

        res.json({ succes: true });
    } catch (err) {
        if (transactionStarted) await db.query("ROLLBACK");
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

        await db.query("UPDATE courses SET commentaire = $1 WHERE id = $2", [commentaire, idCourse]);
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
        await db.query("UPDATE courses SET photo = $1 WHERE id = $2", [buffer, idCourse]);
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
        await db.query("UPDATE courses SET photo = NULL WHERE id = $1", [idCourse]);
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.get("/api/courses/:id/photo", async (req, res) => {
    try {
        const result = await db.query("SELECT photo FROM courses WHERE id = $1", [req.params.id]);
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

        await db.query("DELETE FROM courses WHERE id = $1", [idCourse]);
        res.json({ succes: true, courses: await chercherCourses() });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/courses/acheter", async (req, res) => {
    let transactionStarted = false;
    try {
        let quantiteEntiere = null;
        const idCourse = req.body.idCourse;
        const quantiteAchetee = req.body.quantiteAchetee;

        if (!idCourse) {
            return res.status(400).json({ erreur: "Aucun article sélectionné." });
        }

        const courseResult = await db.query("SELECT food_id FROM courses WHERE id = $1", [idCourse]);
        if (courseResult.rows.length === 0) {
            return res.status(400).json({ erreur: "Article introuvable." });
        }
        const foodId = courseResult.rows[0].food_id;

        let trackingType = null;
        if (foodId) {
            const resultFood = await db.query("SELECT tracking_type FROM foods WHERE id = $1", [foodId]);
            trackingType = resultFood.rows[0].tracking_type;
            if (trackingType !== 'cl') {
                quantiteEntiere = Math.round(Number(quantiteAchetee));
                if (!quantiteAchetee || !Number.isFinite(quantiteEntiere) || quantiteEntiere < 1) {
                    return res.status(400).json({ erreur: "Quantité invalide." });
                }
            }
        }

        await db.query("BEGIN");
        transactionStarted = true;

        const achatResult = await db.query(
            "UPDATE courses SET achete = true, photo = NULL, date_achat = NOW() WHERE id = $1 AND achete = false RETURNING id",
            [idCourse]
        );

        if (achatResult.rows.length > 0 && foodId) {
            if (trackingType === 'cl') {
                await db.query(
                    "INSERT INTO stock (food_id, quantite, date_maj) VALUES ($1, 'plein', NOW()) ON CONFLICT (food_id) DO UPDATE SET quantite = 'plein', date_maj = NOW()",
                    [foodId]
                );
            } else {
                await db.query(
                    `INSERT INTO stock (food_id, quantite, date_maj) VALUES ($1, $2, NOW())
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

        await db.query("COMMIT");
        transactionStarted = false;
        res.json({ succes: true, courses: await chercherCourses() });
    } catch (err) {
        if (transactionStarted) await db.query("ROLLBACK");
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
            `INSERT INTO journal_repas (food_id, quantite_g, ordre)
             VALUES ($1, $2, COALESCE((SELECT MAX(ordre) FROM journal_repas WHERE date_entree = CURRENT_DATE), 0) + 1)
             RETURNING id`,
            [idAliment, quantiteG]
        );
        const nouvelId = insertResult.rows[0].id;

        const itemResult = await db.query(
            `SELECT journal_repas.*, foods.nom, foods.emoji, foods.categorie,
            foods.grammes_par_cuil_a_cafe, foods.grammes_par_cuil_a_soupe,
            foods.poids_unite_g, foods.unite AS unite_piece, foods.tracking_type,
            ROUND(foods.calories * journal_repas.quantite_g / 100, 1) AS calories_calc,
            ROUND(foods.glucides * journal_repas.quantite_g / 100, 1) AS glucides_calc,
            ROUND(foods.proteines * journal_repas.quantite_g / 100, 1) AS proteines_calc,
            ROUND(foods.lipides * journal_repas.quantite_g / 100, 1) AS lipides_calc
     FROM journal_repas
     JOIN foods ON journal_repas.food_id = foods.id
     WHERE journal_repas.id = $1`,
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
            "UPDATE journal_repas SET quantite_g = $1, unite = COALESCE($3, unite) WHERE id = $2",
            [nouvelleQuantite, idEntree, uniteValide(req.body.unite)]
        );

        const itemResult = await db.query(
            `SELECT journal_repas.*, foods.nom, foods.emoji,
                    ROUND(foods.calories * journal_repas.quantite_g / 100, 1) AS calories_calc,
                    ROUND(foods.glucides * journal_repas.quantite_g / 100, 1) AS glucides_calc,
                    ROUND(foods.proteines * journal_repas.quantite_g / 100, 1) AS proteines_calc,
                    ROUND(foods.lipides * journal_repas.quantite_g / 100, 1) AS lipides_calc
             FROM journal_repas
             JOIN foods ON journal_repas.food_id = foods.id
             WHERE journal_repas.id = $1`,
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

        await db.query("DELETE FROM journal_repas WHERE id = $1", [idEntree]);
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
        const r = await db.query("UPDATE journal_repas SET ajoute = $1 WHERE id = $2 RETURNING id", [req.body.ajoute, idEntree]);
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
            `UPDATE journal_repas j SET ordre = v.position
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
        await db.query("DELETE FROM journal_repas WHERE date_entree = CURRENT_DATE");
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

async function remplacerCuisine(lignes) {
    await db.query("BEGIN");
    try {
        await db.query("DELETE FROM journal_repas WHERE date_entree = CURRENT_DATE");
        const nouvellesEntrees = [];
        let ordre = 1;
        for (const ligne of lignes) {
            const insertResult = await db.query(
                "INSERT INTO journal_repas (food_id, quantite_g, ordre, unite) VALUES ($1, $2, $3, $4) RETURNING id",
                [ligne.food_id, ligne.quantite_g, ordre, uniteValide(ligne.unite)]
            );
            nouvellesEntrees.push(insertResult.rows[0].id);
            ordre++;
        }
        const itemsResult = await db.query(`
            SELECT
                journal_repas.*,
                foods.nom,
                foods.emoji,
                foods.categorie,
                foods.grammes_par_cuil_a_cafe,
                foods.grammes_par_cuil_a_soupe,
                foods.poids_unite_g,
                foods.unite AS unite_piece,
                foods.tracking_type,
                ROUND(foods.calories * journal_repas.quantite_g / 100, 1) AS calories_calc,
                ROUND(foods.glucides * journal_repas.quantite_g / 100, 1) AS glucides_calc,
                ROUND(foods.proteines * journal_repas.quantite_g / 100, 1) AS proteines_calc,
                ROUND(foods.lipides * journal_repas.quantite_g / 100, 1) AS lipides_calc
            FROM journal_repas
            JOIN foods
                ON journal_repas.food_id = foods.id
            WHERE journal_repas.id = ANY($1)
            ORDER BY journal_repas.ordre ASC
        `, [nouvellesEntrees]);
        await db.query("COMMIT");
        return itemsResult.rows;
    } catch (err) {
        await db.query("ROLLBACK");
        throw err;
    }
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
            "SELECT food_id, quantite_g, unite FROM recette_ingredients WHERE recette_id = $1 ORDER BY id",
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
        const existants = await db.query("SELECT id FROM foods WHERE id = ANY($1)", [lignes.map((l) => String(l.food_id))]);
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
            "INSERT INTO recettes (nom, categorie, etapes) VALUES ($1, $2, $3) RETURNING id",
            [nom, categorie, etapes]
        );
        const idRecette = recetteResult.rows[0].id;

        for (const ingredient of ingredients) {
            await db.query(
                "INSERT INTO recette_ingredients (recette_id, food_id, quantite_g, unite) VALUES ($1, $2, $3, $4)",
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
            "SELECT id, nom, categorie, etapes FROM recettes WHERE id = $1",
            [idRecette]
        );
        if (recetteResult.rows.length === 0) {
            return res.status(404).json({ erreur: "Recette introuvable." });
        }

        const ingredientsResult = await db.query(
            `SELECT foods.id AS food_id, foods.nom, foods.emoji, recette_ingredients.quantite_g, recette_ingredients.unite,
                    foods.grammes_par_cuil_a_cafe, foods.grammes_par_cuil_a_soupe,
                    foods.poids_unite_g, foods.unite AS unite_piece, foods.tracking_type
             FROM recette_ingredients
             JOIN foods ON foods.id = recette_ingredients.food_id
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
    let transactionStarted = false;

    try {
        const idRecette = req.params.id;
        const nom = req.body.nom;
        const categorie = req.body.categorie || "plat";
        const etapes = typeof req.body.etapes === "string" ? req.body.etapes.trim() : "";
        const ingredients = req.body.ingredients;

        if (!nom || !ingredients || ingredients.length === 0) {
            return res.status(400).json({ erreur: "Nom et au moins un ingrédient requis." });
        }

        await db.query("BEGIN");
        transactionStarted = true;

        await db.query(
            "UPDATE recettes SET nom = $1, categorie = $2, etapes = $3 WHERE id = $4",
            [nom, categorie, etapes, idRecette]
        );

        await db.query("DELETE FROM recette_ingredients WHERE recette_id = $1", [idRecette]);

        for (const ingredient of ingredients) {
            await db.query(
                "INSERT INTO recette_ingredients (recette_id, food_id, quantite_g, unite) VALUES ($1, $2, $3, $4)",
                [idRecette, ingredient.food_id, ingredient.quantite_g, uniteValide(ingredient.unite)]
            );
        }

        await db.query("COMMIT");
        transactionStarted = false;

        const totaux = await calculerTotauxRecette(idRecette);
        res.json({ succes: true, recette: { etapes: etapes, nb_ingredients: totaux.nb_ingredients, kcal_total: totaux.kcal_total } });
    } catch (err) {
        if (transactionStarted) {
            await db.query("ROLLBACK");
        }
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post("/api/recettes/:id/supprimer", async (req, res) => {
    let transactionStarted = false;

    try {
        const idRecette = req.params.id;

        await db.query("BEGIN");
        transactionStarted = true;

        await db.query("DELETE FROM recette_ingredients WHERE recette_id = $1", [idRecette]);
        await db.query("DELETE FROM recettes WHERE id = $1", [idRecette]);

        await db.query("COMMIT");
        transactionStarted = false;

        res.json({ succes: true });
    } catch (err) {
        if (transactionStarted) {
            await db.query("ROLLBACK");
        }
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
            "SELECT food_id, quantite_g FROM journal_repas WHERE date_entree = CURRENT_DATE"
        );

        if (journalResult.rows.length === 0) {
            return res.status(400).json({ erreur: "La cuisine du jour est vide." });
        }

        const recetteResult = await db.query(
            "INSERT INTO recettes (nom, categorie) VALUES ($1, $2) RETURNING id",
            [nom, categorie]
        );
        const idRecette = recetteResult.rows[0].id;

        for (const entree of journalResult.rows) {
            await db.query(
                "INSERT INTO recette_ingredients (recette_id, food_id, quantite_g) VALUES ($1, $2, $3)",
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
