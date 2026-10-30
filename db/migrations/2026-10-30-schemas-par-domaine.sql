-- Passage de la base à un schéma par domaine (famille, achats, chow, reference, app).
-- Lancé une seule fois au démarrage, tant que public.foods existe, dans une transaction.
-- Les anciennes tables d'achats restent dans le schéma « ancien » jusqu'à la vérification de novembre.

CREATE SCHEMA famille;
CREATE SCHEMA achats;
CREATE SCHEMA chow;
CREATE SCHEMA reference;
CREATE SCHEMA app;
CREATE SCHEMA ancien;

-- famille
CREATE TABLE famille.personnes (
    id TEXT PRIMARY KEY,
    prenom TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('parent', 'enfant')),
    date_naissance DATE,
    sexe TEXT CHECK (sexe IN ('F', 'M')),
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.users SET SCHEMA famille;
ALTER TABLE famille.users RENAME TO comptes;
ALTER TABLE famille.comptes RENAME COLUMN password TO mot_de_passe;
ALTER TABLE famille.comptes RENAME COLUMN created_at TO cree_le;
ALTER TABLE famille.comptes ADD COLUMN personne_id TEXT REFERENCES famille.personnes (id);

-- app
ALTER TABLE public.session SET SCHEMA app;
ALTER TABLE app.session RENAME TO sessions;
ALTER TABLE public.ip_bloquees SET SCHEMA app;

-- reference
ALTER TABLE public.indices_france SET SCHEMA reference;
ALTER TABLE reference.indices_france RENAME TO indices_prix;
ALTER TABLE reference.indices_prix ADD COLUMN source TEXT NOT NULL DEFAULT 'INSEE';

-- chow : tables déplacées, données inchangées
ALTER TABLE public.foods SET SCHEMA chow;
ALTER TABLE chow.foods RENAME TO aliments;
ALTER TABLE public.stock SET SCHEMA chow;
ALTER TABLE public.courses SET SCHEMA chow;
ALTER TABLE public.courses_preset SET SCHEMA chow;
ALTER TABLE chow.courses_preset RENAME TO courses_modeles;
ALTER TABLE public.journal_repas SET SCHEMA chow;
ALTER TABLE chow.journal_repas RENAME TO journal;
ALTER TABLE chow.journal ADD COLUMN personne_id TEXT REFERENCES famille.personnes (id);
ALTER TABLE public.recettes SET SCHEMA chow;
ALTER TABLE public.recette_ingredients SET SCHEMA chow;

-- anciennes tables d'achats, gardées pour comparaison
ALTER TABLE public.tickets SET SCHEMA ancien;
ALTER TABLE public.achats SET SCHEMA ancien;
ALTER TABLE public.libelles SET SCHEMA ancien;
ALTER TABLE public.promos SET SCHEMA ancien;

-- achats : référentiels
CREATE TABLE achats.enseignes (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL UNIQUE
);
INSERT INTO achats.enseignes (id, nom) VALUES
    ('leclerc', 'Leclerc'), ('carrefour', 'Carrefour'), ('marche-frais', 'Marché Frais');

CREATE TABLE achats.magasins (
    id TEXT PRIMARY KEY,
    enseigne_id TEXT NOT NULL REFERENCES achats.enseignes (id),
    nom TEXT NOT NULL UNIQUE,
    ville TEXT
);
INSERT INTO achats.magasins (id, enseigne_id, nom, ville) VALUES
    ('carrefour-city-chatelet', 'carrefour', 'Carrefour City Paris Gare Chatelet Les Halles', 'Paris'),
    ('carrefour-city-republique', 'carrefour', 'Carrefour City Quartier Clermont Ferrand République', 'Clermont-Ferrand'),
    ('carrefour-market-hugo', 'carrefour', 'Carrefour Market Bordeaux Hugo', 'Bordeaux'),
    ('carrefour-market-jaude', 'carrefour', 'Carrefour Market Clermont-Ferrand Jaude', 'Clermont-Ferrand'),
    ('carrefour-market-trilport', 'carrefour', 'Carrefour Market Trilport', 'Trilport'),
    ('leclerc-brezet', 'leclerc', 'Leclerc Brezet', 'Clermont-Ferrand'),
    ('leclerc-la-pardieu', 'leclerc', 'Leclerc LaPardieu', 'Clermont-Ferrand'),
    ('leclerc-meaux', 'leclerc', 'Leclerc Meaux', 'Meaux'),
    ('marche-frais-meaux', 'marche-frais', 'Marché Frais Meaux', 'Meaux');

CREATE TABLE achats.categories (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    parent_id TEXT REFERENCES achats.categories (id),
    ordre INTEGER NOT NULL DEFAULT 0
);
INSERT INTO achats.categories (id, nom, parent_id, ordre) VALUES
    ('alimentation', 'Alimentation', NULL, 1),
    ('boissons', 'Boissons', NULL, 2),
    ('hygiene-beaute', 'Hygiène et beauté', NULL, 3),
    ('entretien', 'Entretien', NULL, 4),
    ('maison-cuisine', 'Maison et cuisine', NULL, 5),
    ('bebe', 'Bébé', NULL, 6),
    ('sante', 'Santé', NULL, 7),
    ('animaux', 'Animaux', NULL, 8),
    ('loisirs-papeterie', 'Loisirs et papeterie', NULL, 9),
    ('vetements', 'Vêtements', NULL, 10),
    ('autre', 'Autre', NULL, 11),
    ('alimentation-legumes', 'Légumes', 'alimentation', 1),
    ('alimentation-fruits', 'Fruits', 'alimentation', 2),
    ('alimentation-viandes', 'Viandes', 'alimentation', 3),
    ('alimentation-poissons', 'Poissons', 'alimentation', 4),
    ('alimentation-oeufs', 'Œufs', 'alimentation', 5),
    ('alimentation-cremerie', 'Crèmerie', 'alimentation', 6),
    ('alimentation-feculents', 'Féculents', 'alimentation', 7),
    ('alimentation-legumineuses', 'Légumineuses', 'alimentation', 8),
    ('alimentation-matieres-grasses', 'Matières grasses', 'alimentation', 9),
    ('alimentation-sauces', 'Sauces', 'alimentation', 10),
    ('alimentation-epices', 'Épices', 'alimentation', 11),
    ('alimentation-epicerie', 'Épicerie', 'alimentation', 12),
    ('alimentation-divers', 'Divers', 'alimentation', 13);

CREATE TABLE achats.articles (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    categorie_id TEXT NOT NULL REFERENCES achats.categories (id),
    unite_ref TEXT NOT NULL CHECK (unite_ref IN ('kg', 'l', 'piece')),
    fourre_tout BOOLEAN NOT NULL DEFAULT false,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE achats.produits (
    id SERIAL PRIMARY KEY,
    enseigne_id TEXT NOT NULL REFERENCES achats.enseignes (id),
    libelle TEXT NOT NULL,
    article_id TEXT REFERENCES achats.articles (id),
    contenance NUMERIC,
    unite TEXT CHECK (unite IN ('kg', 'l', 'piece')),
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (enseigne_id, libelle)
);
CREATE INDEX produits_article ON achats.produits (article_id);

CREATE TABLE achats.tickets (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    magasin_id TEXT NOT NULL REFERENCES achats.magasins (id),
    date DATE NOT NULL,
    heure TIME,
    numero TEXT,
    source TEXT NOT NULL CHECK (source IN ('ticket-papier', 'ticket-numerique', 'releve-bancaire', 'saisie')),
    total_articles NUMERIC(10, 2),
    bons NUMERIC(10, 2) NOT NULL DEFAULT 0,
    paye NUMERIC(10, 2) NOT NULL,
    cagnotte NUMERIC(10, 2),
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tickets_date ON achats.tickets (date);

CREATE TABLE achats.lignes (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES achats.tickets (id) ON DELETE CASCADE,
    produit_id INTEGER NOT NULL REFERENCES achats.produits (id),
    rayon TEXT,
    quantite NUMERIC NOT NULL CHECK (quantite > 0),
    unite_vente TEXT NOT NULL CHECK (unite_vente IN ('piece', 'kg')),
    prix_unitaire NUMERIC(10, 2),
    montant NUMERIC(10, 2) NOT NULL
);
CREATE INDEX lignes_ticket ON achats.lignes (ticket_id);
CREATE INDEX lignes_produit ON achats.lignes (produit_id);

CREATE TABLE achats.promos (
    id SERIAL PRIMARY KEY,
    ligne_id INTEGER NOT NULL REFERENCES achats.lignes (id) ON DELETE CASCADE,
    offre TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('remise immédiate', '2e à prix réduit', '2+1')),
    pourcentage INTEGER,
    montant NUMERIC(10, 2) NOT NULL CHECK (montant > 0)
);
CREATE INDEX promos_ligne ON achats.promos (ligne_id);

-- Conversion des achats

-- Articles : un par aliment Chow, plus deux fourre-tout explicites en attendant le catalogue.
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref)
SELECT f.id, f.nom,
       CASE f.categorie
           WHEN 'Légumes' THEN 'alimentation-legumes' WHEN 'Fruits' THEN 'alimentation-fruits'
           WHEN 'Viandes' THEN 'alimentation-viandes' WHEN 'Poissons' THEN 'alimentation-poissons'
           WHEN 'Oeufs' THEN 'alimentation-oeufs' WHEN 'Laitiers' THEN 'alimentation-cremerie'
           WHEN 'Féculents' THEN 'alimentation-feculents' WHEN 'Légumineuses' THEN 'alimentation-legumineuses'
           WHEN 'Lipides' THEN 'alimentation-matieres-grasses' WHEN 'Sauces' THEN 'alimentation-sauces'
           WHEN 'Épices' THEN 'alimentation-epices' WHEN 'Épicerie' THEN 'alimentation-epicerie'
           WHEN 'Boissons' THEN 'boissons' ELSE 'alimentation-divers'
       END,
       COALESCE((
           SELECT CASE WHEN a.poids IS NOT NULL THEN 'kg' ELSE COALESCE(a.unite, 'piece') END
           FROM ancien.achats a JOIN ancien.libelles l ON l.libelle = a.libelle
           WHERE l.food_id = f.id
           GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1
       ), CASE WHEN f.unite = 'g' THEN 'kg' WHEN f.unite = 'ml' THEN 'l' ELSE 'piece' END)
FROM chow.aliments f;

INSERT INTO achats.articles (id, nom, categorie_id, unite_ref, fourre_tout) VALUES
    ('alimentation-a-detailler', 'Alimentation (à détailler)', 'alimentation', 'piece', true),
    ('non-alimentaire-a-classer', 'Non alimentaire (à classer)', 'autre', 'piece', true);

ALTER TABLE chow.aliments ADD COLUMN article_id TEXT UNIQUE REFERENCES achats.articles (id);
UPDATE chow.aliments SET article_id = id;

-- Produits : un par enseigne et libellé imprimé, avec le format le plus fréquent de ses lignes.
INSERT INTO achats.produits (enseigne_id, libelle, article_id, contenance, unite)
SELECT e.id, a.libelle,
       CASE l.statut
           WHEN 'chow' THEN l.food_id
           WHEN 'hors-chow' THEN 'alimentation-a-detailler'
           WHEN 'non-alimentaire' THEN 'non-alimentaire-a-classer'
       END,
       mode() WITHIN GROUP (ORDER BY a.contenance) FILTER (WHERE a.poids IS NULL),
       CASE WHEN bool_and(a.poids IS NOT NULL) THEN 'kg'
            ELSE COALESCE(mode() WITHIN GROUP (ORDER BY a.unite) FILTER (WHERE a.poids IS NULL), 'piece') END
FROM ancien.achats a
JOIN ancien.tickets t ON t.id = a.ticket_id
JOIN achats.enseignes e ON e.nom = t.enseigne
LEFT JOIN ancien.libelles l ON l.libelle = a.libelle
WHERE coalesce(l.statut, '') <> 'non-detaille'
GROUP BY e.id, a.libelle, l.statut, l.food_id;

-- Formats connus absents du libellé (règles FORMATS de tickets/extraire.cjs), importés avant ces règles.
UPDATE achats.produits SET contenance = 1, unite = 'kg' WHERE libelle LIKE 'SH SURG X10%';
UPDATE achats.produits SET contenance = 2.5, unite = 'kg' WHERE libelle LIKE 'AIGUILL%' AND unite <> 'kg';

-- Format à la pièce : 1, sauf les boîtes d'œufs dont le nombre est imprimé (« 12P », « X6 »).
UPDATE achats.produits SET contenance = COALESCE(
        (SELECT (regexp_match(libelle, '(\d+)\s*P\M'))[1]::numeric WHERE article_id LIKE 'oeuf%'),
        (SELECT (regexp_match(libelle, 'X\s*(\d+)\M'))[1]::numeric WHERE article_id LIKE 'oeuf%'),
        1)
WHERE unite = 'piece' AND contenance IS NULL;

-- Tickets : mêmes identifiants qu'avant.
INSERT INTO achats.tickets (id, code, magasin_id, date, source, total_articles, paye)
SELECT t.id,
       to_char(t.date, 'YYYY-MM-DD') || '-' || m.id,
       m.id, t.date,
       CASE WHEN EXISTS (SELECT 1 FROM ancien.achats a JOIN ancien.libelles l ON l.libelle = a.libelle
                         WHERE a.ticket_id = t.id AND l.statut = 'non-detaille') THEN 'releve-bancaire'
            WHEN t.enseigne = 'Marché Frais' THEN 'ticket-papier'
            ELSE 'ticket-numerique' END,
       NULL, t.total
FROM ancien.tickets t
JOIN achats.magasins m ON m.nom = t.magasin;
SELECT setval('achats.tickets_id_seq', (SELECT max(id) FROM achats.tickets));

-- Lignes : montant avant remise ; la remise passe dans promos.
CREATE TEMP TABLE correspondance_lignes ON COMMIT DROP AS
SELECT a.id AS ancien_id, nextval('achats.lignes_id_seq') AS id, a.ticket_id, p.id AS produit_id, a.rayon,
       COALESCE(a.poids, a.quantite, 1) AS quantite,
       CASE WHEN a.poids IS NOT NULL THEN 'kg' ELSE 'piece' END AS unite_vente,
       a.prix_unitaire, a.total + a.remise AS montant, a.remise, a.libelle, t.date, t.magasin
FROM ancien.achats a
JOIN ancien.tickets t ON t.id = a.ticket_id
JOIN achats.enseignes e ON e.nom = t.enseigne
JOIN achats.produits p ON p.enseigne_id = e.id AND p.libelle = a.libelle
ORDER BY a.id;

INSERT INTO achats.lignes (id, ticket_id, produit_id, rayon, quantite, unite_vente, prix_unitaire, montant)
SELECT id, ticket_id, produit_id, rayon, quantite, unite_vente, prix_unitaire, montant FROM correspondance_lignes;

UPDATE achats.tickets t SET total_articles = s.montant
FROM (SELECT ticket_id, sum(montant) AS montant FROM achats.lignes GROUP BY ticket_id) s
WHERE s.ticket_id = t.id;

-- Promos : chaque remise rattachée à sa ligne (même ticket, même libellé, dans l'ordre).
INSERT INTO achats.promos (ligne_id, offre, type, pourcentage, montant)
SELECT c.id, p.offre, p.type, p.pourcentage, p.montant
FROM (SELECT p.*, row_number() OVER (PARTITION BY p.date, p.magasin, p.produit ORDER BY p.id) AS rang FROM ancien.promos p) p
JOIN (SELECT c.*, row_number() OVER (PARTITION BY c.date, c.magasin, c.libelle ORDER BY c.ancien_id) AS rang
      FROM correspondance_lignes c WHERE c.remise > 0) c
  ON c.date = p.date AND c.magasin = p.magasin AND c.libelle = p.produit AND c.rang = p.rang;

-- Contrôles : la conversion s'arrête si un montant ne correspond pas.
DO $$
DECLARE
    ecart NUMERIC;
BEGIN
    SELECT abs((SELECT sum(total) FROM ancien.tickets) - (SELECT sum(paye) FROM achats.tickets)) INTO ecart;
    IF ecart > 0.01 THEN RAISE EXCEPTION 'Total payé différent après conversion : % €', ecart; END IF;
    SELECT abs((SELECT sum(remise) FROM ancien.achats) - (SELECT sum(montant) FROM achats.promos)) INTO ecart;
    IF ecart > 0.01 THEN RAISE EXCEPTION 'Remises différentes après conversion : % €', ecart; END IF;
    IF (SELECT count(*) FROM ancien.achats a JOIN ancien.libelles l ON l.libelle = a.libelle WHERE l.statut <> 'non-detaille')
       + (SELECT count(*) FROM ancien.achats a WHERE NOT EXISTS (SELECT 1 FROM ancien.libelles l WHERE l.libelle = a.libelle))
       <> (SELECT count(*) FROM achats.lignes) THEN
        RAISE EXCEPTION 'Nombre de lignes différent après conversion';
    END IF;
    IF (SELECT count(*) FROM ancien.tickets) <> (SELECT count(*) FROM achats.tickets) THEN
        RAISE EXCEPTION 'Nombre de tickets différent après conversion';
    END IF;
END $$;
