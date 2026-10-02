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

// DATABASE_URL en prod, sinon les DB_* séparées en local.
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

// Pas d'outil de migration : ces ALTER TABLE (IF NOT EXISTS) tournent à chaque démarrage, sûrs à rejouer.
await db.query("ALTER TABLE recettes ADD COLUMN IF NOT EXISTS categorie TEXT NOT NULL DEFAULT 'plat'");
// Une ligne de texte = une étape ; suffisant pour les recettes courtes du foyer, sans table supplémentaire.
await db.query("ALTER TABLE recettes ADD COLUMN IF NOT EXISTS etapes TEXT NOT NULL DEFAULT ''");

// Poids par cuillère : pas de conversion universelle, mesuré et stocké par aliment (voir /aliments/:id/equivalences).
await db.query("ALTER TABLE foods ADD COLUMN IF NOT EXISTS grammes_par_cuil_a_cafe NUMERIC");
await db.query("ALTER TABLE foods ADD COLUMN IF NOT EXISTS grammes_par_cuil_a_soupe NUMERIC");

// Ordre d'affichage du journal, réarrangeable à la main (voir /calories/deplacer).
await db.query("ALTER TABLE journal_repas ADD COLUMN IF NOT EXISTS ordre INTEGER");

// BYTEA plutôt qu'un fichier disque : le disque Fly est éphémère (auto_stop_machines).
await db.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS photo BYTEA");
// Comble l'ordre des entrées existantes (jamais réordonnées) par heure d'ajout ; idempotent.
await db.query(`
    UPDATE journal_repas SET ordre = sub.rn
    FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY date_entree ORDER BY heure_entree) AS rn
        FROM journal_repas WHERE ordre IS NULL
    ) sub
    WHERE journal_repas.id = sub.id
`);

// Table du preset "Semaine" (voir /courses/preset-hebdo/enregistrer).
await db.query(`
    CREATE TABLE IF NOT EXISTS courses_preset (
        id SERIAL PRIMARY KEY,
        food_id TEXT REFERENCES foods(id),
        nom_libre TEXT
    )
`);

// Colonnes mortes, jamais lues ni écrites (reliquat d'avant la répartition cl/quantité/libre).
await db.query("ALTER TABLE courses DROP COLUMN IF EXISTS quantite");
await db.query("ALTER TABLE courses DROP COLUMN IF EXISTS unite");
await db.query("ALTER TABLE courses DROP COLUMN IF EXISTS magasin");

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
// 4mb : une photo compressée en base64 (voir /courses/:id/photo) dépasse la limite par défaut de 100kb.
app.use(express.json({ limit: "4mb" }));

app.set("view engine", "ejs");

// currentPath dispo dans toutes les vues, pour surligner le lien de menu actif.
app.use(function (req, res, next) {
    res.locals.currentPath = req.path;
    next();
});

// ============================================
// AUTHENTIFICATION (accès limité aux 2 personnes du foyer, voir table "users")
// ============================================
// Pas de route "/register" : comptes créés une fois via scripts/creer-utilisateur.js.

// Sessions en base (pas en mémoire) : les machines Fly s'arrêtent automatiquement et effaceraient tout.
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
    rolling: true, // chaque visite relance les 360 jours : jamais déconnecté tant que l'app sert
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30 * 12, // 1 an
        sameSite: "lax", // bloque les actions déclenchées depuis un autre site
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // HTTPS seulement en prod, le local reste en HTTP
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

// Seul l'id est gardé en session ; deserializeUser recharge le reste depuis la base à chaque requête.
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

// Bloque toute page tant qu'on n'est pas connecté, sauf /login elle-même (voir les routes
// juste en dessous, déclarées AVANT ce middleware pour rester accessibles sans être connecté).
function requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    // L'app React lit du JSON : une redirection vers la page HTML de connexion serait illisible pour elle.
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

app.get("/login", function (req, res) {
    res.render("login.ejs", { title: "Connexion", erreur: req.query.erreur === "1" });
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login?erreur=1",
}));

app.post("/logout", function (req, res) {
    req.logout(function () {
        res.redirect("/login");
    });
});

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

// Nom d'unité à afficher selon le type de suivi de l'aliment.
const uniteParType = { unite: 'unités', pack: 'packs', cl: 'cl' };

async function chercherAliments() {
    const result = await db.query("SELECT * FROM foods");
    return result.rows
}

async function chercherStock() {
    // deja_en_courses : évite de reproposer "Ajouter aux courses" si déjà en attente d'achat.
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
    // "courses.*" évité : inclurait la colonne "photo" (BYTEA) entière ; has_photo suffit ici.
    const result = await db.query(
        `SELECT courses.id, courses.food_id, courses.nom_libre, courses.commentaire, courses.achete,
                courses.date_ajout,
                (courses.photo IS NOT NULL) AS has_photo,
                COALESCE(foods.nom, courses.nom_libre) AS nom, COALESCE(foods.emoji, '🆕') AS emoji,
                foods.unite AS food_unite, foods.tracking_type, foods.categorie, stock.quantite AS quantite_stock
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

// Même calcul que chercherRecettes mais pour une seule recette : renvoie le vrai total tout de suite après création/modification.
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

// Journal du jour, avec calories/glucides/protéines/lipides recalculés selon la quantité mangée.
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

// Données de chaque page, partagées entre le rendu EJS et l'API lue par React.
async function chercherAliment(idAliment) {
    const result = await db.query("SELECT * FROM foods WHERE id = $1", [idAliment]);
    return result.rows[0];
}

async function chargerPageStock() {
    return { stock: await chercherStock(), aliments: await chercherAliments() };
}

async function chargerPageCourses() {
    const courses = await chercherCourses();
    const aliments = await chercherAliments();
    const stock = await chercherStock();
    // Transmis au client pour comparer en direct à la liste actuelle et activer/désactiver "Enregistrer" (voir courses.js).
    const presetHebdo = await db.query("SELECT food_id, nom_libre FROM courses_preset");
    return { courses, aliments, stock, presetHebdo: presetHebdo.rows };
}

async function chargerPageCalories() {
    return { journal: await chercherJournalDuJour(), aliments: await chercherAliments(), recettes: await chercherRecettes() };
}

// Réponse JSON commune des lectures /api : même erreur 500 que les mutations.
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

// ============================================
// PAGE D'ACCUEIL
// ============================================

app.get("/", async (req, res) => {
    try {
        res.render("index.ejs", { title: "Accueil" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

// ============================================
// ALIMENTS
// ============================================

app.get("/aliments", async (req, res) => {
    try {
        const aliments = await chercherAliments()
        res.render("aliments.ejs", {
            title: "Aliments",
            aliments: aliments

        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/aliments/:idAliment", async (req, res) => {
    try {
        const aliment = await chercherAliment(req.params.idAliment);
        if (!aliment) { return res.status(404).render("aliment-detail.ejs", { title: "Aliment introuvable", aliment: null }); }
        res.render("aliment-detail.ejs", {
            title: aliment.nom,
            aliment: aliment
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

app.post(["/aliments/:idAliment/equivalences", "/api/aliments/:idAliment/equivalences"], async (req, res) => {
    try {
        const idAliment = req.params.idAliment;
        // Vide (non pesé) stocké en NULL, pas 0, pour distinguer "non renseigné" de "pèse 0g".
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

// ============================================
// STOCK
// ============================================

app.get("/stock", async (req, res) => {
    try {
        res.render("stock.ejs", { title: "Stock", ...(await chargerPageStock()) });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

app.post(["/stock/ajouter", "/api/stock/ajouter"], async (req, res) => {
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

app.post(["/stock/modifier", "/api/stock/modifier"], async (req, res) => {
    try {
        const nouvelleQuantite = req.body.nouvelleQuantite;
        const idStock = req.body.idStock;

        if (!nouvelleQuantite) {
            return res.status(400).json({ erreur: "Champs requis." });
        }

        // date_maj ne change qu'à la création ou un ajout depuis les courses, jamais sur une simple correction.
        await db.query("UPDATE stock SET quantite = $1 WHERE id = $2", [nouvelleQuantite, idStock]);
        res.json({ succes: true, quantite: nouvelleQuantite });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post(["/stock/supprimer", "/api/stock/supprimer"], async (req, res) => {
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

// ============================================
// COURSES
// ============================================

app.get("/courses", async (req, res) => {
    try {
        res.render("courses.ejs", { title: "Courses", ...(await chargerPageCourses()) });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

// idAliment pour un aliment connu, sinon nom_libre pour un texte tapé qui n'existe pas encore dans "foods".
app.post(["/courses/ajouter", "/api/courses/ajouter"], async (req, res) => {
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
                    foods.unite AS food_unite, foods.tracking_type, foods.categorie, stock.quantite AS quantite_stock
             FROM courses
             LEFT JOIN foods ON courses.food_id = foods.id
             LEFT JOIN stock ON stock.food_id = courses.food_id
             WHERE courses.id = $1`,
            [nouvelId]
        );

        res.json({ succes: true, item: itemResult.rows[0] });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

// N'ajoute que les articles du preset absents de la liste en attente, pour éviter les doublons si on clique plusieurs fois.
app.post(["/courses/preset-hebdo", "/api/courses/preset-hebdo"], async (req, res) => {
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
            return res.json({ succes: true, items: [] });
        }

        const itemsResult = await db.query(
            `SELECT courses.*, COALESCE(foods.nom, courses.nom_libre) AS nom, COALESCE(foods.emoji, '🆕') AS emoji,
                    foods.unite AS food_unite, foods.tracking_type, foods.categorie, stock.quantite AS quantite_stock
             FROM courses
             LEFT JOIN foods ON courses.food_id = foods.id
             LEFT JOIN stock ON stock.food_id = courses.food_id
             WHERE courses.id = ANY($1)`,
            [nouveauxIds]
        );

        res.json({ succes: true, items: itemsResult.rows });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

// DELETE + réinsertion plutôt qu'un diff ligne à ligne (comme /recettes/:id/modifier) : plus simple, liste toujours courte.
app.post(["/courses/preset-hebdo/enregistrer", "/api/courses/preset-hebdo/enregistrer"], async (req, res) => {
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

app.post(["/courses/commentaire", "/api/courses/commentaire"], async (req, res) => {
    try {
        const idCourse = req.body.idCourse;
        const commentaire = req.body.commentaire;

        if (!idCourse) {
            return res.status(400).json({ erreur: "Aucun article sélectionné." });
        }

        await db.query("UPDATE courses SET commentaire = $1 WHERE id = $2", [commentaire, idCourse]);
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

// Photo envoyée en base64, déjà compressée côté client (voir courses.js) ; le serveur ne fait que décoder et stocker.
app.post(["/courses/photo", "/api/courses/photo"], async (req, res) => {
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

app.post(["/courses/photo/supprimer", "/api/courses/photo/supprimer"], async (req, res) => {
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

// Sert l'image elle-même, appelée seulement à l'ouverture de la photo (voir has_photo dans chercherCourses).
app.get(["/courses/:id/photo", "/api/courses/:id/photo"], async (req, res) => {
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

app.post(["/courses/supprimer", "/api/courses/supprimer"], async (req, res) => {
    try {
        const idCourse = req.body.idCourse;
        if (!idCourse) {
            return res.status(400).json({ erreur: "Aucune ligne sélectionnée" });
        }

        await db.query("DELETE FROM courses WHERE id = $1", [idCourse]);
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post(["/courses/acheter", "/api/courses/acheter"], async (req, res) => {
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

        // Un nom_libre n'a pas de food_id : rien à mettre à jour dans le stock.
        let trackingType = null;
        if (foodId) {
            const resultFood = await db.query("SELECT tracking_type FROM foods WHERE id = $1", [foodId]);
            trackingType = resultFood.rows[0].tracking_type;
            if (trackingType !== 'cl') {
                // Arrondi côté serveur : ce formulaire passe par fetch, donc la validation native (min/type=number) du champ n'a jamais lieu.
                quantiteEntiere = Math.round(Number(quantiteAchetee));
                if (!quantiteAchetee || !Number.isFinite(quantiteEntiere) || quantiteEntiere < 1) {
                    return res.status(400).json({ erreur: "Quantité invalide." });
                }
            }
        }

        await db.query("BEGIN");
        transactionStarted = true;

        // Marque l'achat d'abord et une seule fois : une requête rejouée (réseau du magasin) ne touche plus au stock.
        // La photo n'a plus d'utilité une fois l'achat fait (elle servait à reconnaître le produit au magasin).
        const achatResult = await db.query(
            "UPDATE courses SET achete = true, photo = NULL WHERE id = $1 AND achete = false RETURNING id",
            [idCourse]
        );

        if (achatResult.rows.length > 0 && foodId) {
            if (trackingType === 'cl') {
                // "cl" (bouteille) : acheter = remettre à "plein". ON CONFLICT évite un doublon si déjà en stock.
                await db.query(
                    "INSERT INTO stock (food_id, quantite, date_maj) VALUES ($1, 'plein', NOW()) ON CONFLICT (food_id) DO UPDATE SET quantite = 'plein', date_maj = NOW()",
                    [foodId]
                );
            } else {
                // Regex avant le cast ::integer : protège contre une ancienne valeur "cl" (ex: "plein") laissée par un changement de type de suivi.
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
        res.json({ succes: true });
    } catch (err) {
        if (transactionStarted) await db.query("ROLLBACK");
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

// ============================================
// CALORIES
// ============================================

app.get("/calories", async (req, res) => {
    try {
        res.render("calories.ejs", { title: "Calories", ...(await chargerPageCalories()) });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

app.post(["/calories/ajouter", "/api/calories/ajouter"], async (req, res) => {
    try {
        const idAliment = req.body.idAliment;
        const quantiteG = req.body.quantiteG || 100;

        if (!idAliment) {
            return res.status(400).json({ erreur: "Champs requis." });
        }

        // Toujours ajouté à la fin (ordre max du jour + 1).
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

app.post(["/calories/modifier", "/api/calories/modifier"], async (req, res) => {
    try {
        const idEntree = req.body.idEntree;
        const nouvelleQuantite = req.body.nouvelleQuantite;

        if (!idEntree || !nouvelleQuantite) {
            return res.status(400).json({ erreur: "Champs requis." });
        }

        await db.query("UPDATE journal_repas SET quantite_g = $1 WHERE id = $2", [nouvelleQuantite, idEntree]);

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

// -- POST /calories/supprimer : identique à avant, garder tel quel --
// Supprimer une entrée du journal alimentaire
app.post(["/calories/supprimer", "/api/calories/supprimer"], async (req, res) => {
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

// Échange l'ordre avec la voisine ("haut"/"bas") plutôt que de renvoyer toute la liste réordonnée.
app.post(["/calories/deplacer", "/api/calories/deplacer"], async (req, res) => {
    try {
        const idEntree = req.body.idEntree;
        const direction = req.body.direction;

        if (!idEntree || (direction !== "haut" && direction !== "bas")) {
            return res.status(400).json({ erreur: "Requête invalide." });
        }

        const actuelResult = await db.query("SELECT ordre FROM journal_repas WHERE id = $1", [idEntree]);
        if (actuelResult.rows.length === 0) {
            return res.status(400).json({ erreur: "Entrée introuvable." });
        }
        const ordreActuel = actuelResult.rows[0].ordre;

        const voisineResult = await db.query(
            `SELECT id, ordre FROM journal_repas
             WHERE date_entree = CURRENT_DATE AND ordre ${direction === "haut" ? "<" : ">"} $1
             ORDER BY ordre ${direction === "haut" ? "DESC" : "ASC"}
             LIMIT 1`,
            [ordreActuel]
        );
        if (voisineResult.rows.length === 0) {
            return res.json({ succes: true });
        }
        const voisine = voisineResult.rows[0];

        await db.query("UPDATE journal_repas SET ordre = $1 WHERE id = $2", [voisine.ordre, idEntree]);
        await db.query("UPDATE journal_repas SET ordre = $1 WHERE id = $2", [ordreActuel, voisine.id]);

        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.post(["/calories/vider", "/api/calories/vider"], async (req, res) => {
    try {
        await db.query("DELETE FROM journal_repas WHERE date_entree = CURRENT_DATE");
        res.json({ succes: true });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

// Remplace le journal du jour par tous les ingrédients d'une recette.
app.post(["/calories/ajouter-recette", "/api/calories/ajouter-recette"], async (req, res) => {
    let transactionStarted = false;

    try {
        const idRecette = req.body.idRecette;

        if (!idRecette) {
            return res.status(400).json({
                erreur: "Aucune recette sélectionnée."
            });
        }

        const ingredients = await db.query(
            "SELECT food_id, quantite_g FROM recette_ingredients WHERE recette_id = $1",
            [idRecette]
        );

        if (ingredients.rows.length === 0) {
            return res.status(400).json({
                erreur: "Cette recette n'a aucun ingrédient."
            });
        }

        await db.query("BEGIN");
        transactionStarted = true;

        await db.query(
            "DELETE FROM journal_repas WHERE date_entree = CURRENT_DATE"
        );

        const nouvellesEntrees = [];

        // Ordre explicite requis : un "ordre" NULL casse silencieusement /calories/deplacer ("ordre < NULL" ne trouve jamais de voisine).
        let ordre = 1;
        for (const ingredient of ingredients.rows) {
            const insertResult = await db.query(
                "INSERT INTO journal_repas (food_id, quantite_g, ordre) VALUES ($1, $2, $3) RETURNING id",
                [ingredient.food_id, ingredient.quantite_g, ordre]
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
        transactionStarted = false;

        res.json({
            succes: true,
            items: itemsResult.rows
        });

    } catch (err) {
        if (transactionStarted) {
            await db.query("ROLLBACK");
        }

        console.log(err);
        res.status(500).json({
            erreur: err.message
        });
    }
});

app.post(["/recettes/creer", "/api/recettes/creer"], async (req, res) => {
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
                "INSERT INTO recette_ingredients (recette_id, food_id, quantite_g) VALUES ($1, $2, $3)",
                [idRecette, ingredient.food_id, ingredient.quantite_g]
            );
        }

        const totaux = await calculerTotauxRecette(idRecette);
        res.json({ succes: true, recette: { id: idRecette, nom: nom, categorie: categorie, etapes: etapes, nb_ingredients: totaux.nb_ingredients, kcal_total: totaux.kcal_total } });
    } catch (err) {
        console.log("ERREUR:", err.message);
        res.status(500).json({ erreur: err.message });
    }
});

app.get(["/recettes/:id", "/api/recettes/:id"], async (req, res) => {
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
            `SELECT foods.id AS food_id, foods.nom, foods.emoji, recette_ingredients.quantite_g,
                    foods.grammes_par_cuil_a_cafe, foods.grammes_par_cuil_a_soupe,
                    foods.poids_unite_g, foods.unite AS unite_piece, foods.tracking_type
             FROM recette_ingredients
             JOIN foods ON foods.id = recette_ingredients.food_id
             WHERE recette_ingredients.recette_id = $1
             ORDER BY foods.nom ASC`,
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

app.post(["/recettes/:id/modifier", "/api/recettes/:id/modifier"], async (req, res) => {
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

        // DELETE + réinsertion plutôt qu'un diff ingrédient par ingrédient : plus simple, liste toujours courte.
        await db.query("DELETE FROM recette_ingredients WHERE recette_id = $1", [idRecette]);

        for (const ingredient of ingredients) {
            await db.query(
                "INSERT INTO recette_ingredients (recette_id, food_id, quantite_g) VALUES ($1, $2, $3)",
                [idRecette, ingredient.food_id, ingredient.quantite_g]
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

app.post(["/recettes/:id/supprimer", "/api/recettes/:id/supprimer"], async (req, res) => {
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

// Une URL /api inconnue répond en JSON, jamais avec la page d'erreur HTML d'Express.
app.use("/api", function (req, res) {
    res.status(404).json({ erreur: "Route inconnue." });
});

app.listen(port, () => {
    console.log(`API is running at http://localhost:${port}`);
});
