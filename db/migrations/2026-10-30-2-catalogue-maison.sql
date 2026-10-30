-- Catalogue des achats non alimentaires : neuf familles, leurs types, les articles du foyer, et l'inventaire de la maison.
-- Les catégories d'aliments restent celles de Chow.

-- Familles et types
ALTER TABLE achats.categories ADD COLUMN consommable BOOLEAN;
COMMENT ON COLUMN achats.categories.consommable IS 'Type consommable (racheté, suivi en inventaire) ou équipement (acheté une fois) ; vide pour une famille.';

INSERT INTO achats.categories (id, nom, parent_id, ordre, consommable) VALUES
    ('hygiene', 'Hygiène', NULL, 3, NULL),
    ('cuisine', 'Cuisine', NULL, 5, NULL),
    ('electronique', 'Électronique', NULL, 6, NULL),
    ('maison', 'Maison', NULL, 9, NULL),
    ('divers', 'Divers', NULL, 11, NULL);
UPDATE achats.categories SET ordre = 4 WHERE id = 'entretien';
UPDATE achats.categories SET ordre = 7 WHERE id = 'bebe';
UPDATE achats.categories SET ordre = 8 WHERE id = 'sante';
UPDATE achats.categories SET ordre = 10 WHERE id = 'animaux';
UPDATE achats.articles SET categorie_id = 'divers' WHERE categorie_id IN ('autre', 'hygiene-beaute', 'maison-cuisine', 'loisirs-papeterie', 'vetements');
DELETE FROM achats.categories WHERE id IN ('hygiene-beaute', 'maison-cuisine', 'loisirs-papeterie', 'vetements', 'autre');

INSERT INTO achats.categories (id, nom, parent_id, ordre, consommable) VALUES
    ('hygiene-toilette', 'Toilette', 'hygiene', 1, true),
    ('hygiene-corps', 'Corps', 'hygiene', 2, true),
    ('hygiene-cheveux', 'Cheveux', 'hygiene', 3, true),
    ('hygiene-dents', 'Dents', 'hygiene', 4, true),
    ('hygiene-rasage', 'Rasage', 'hygiene', 5, true),
    ('hygiene-protections', 'Protections', 'hygiene', 6, true),
    ('hygiene-soins', 'Soins', 'hygiene', 7, true),
    ('entretien-linge', 'Linge', 'entretien', 1, true),
    ('entretien-vaisselle', 'Vaisselle', 'entretien', 2, true),
    ('entretien-surfaces', 'Surfaces', 'entretien', 3, true),
    ('entretien-sols-wc', 'Sols et WC', 'entretien', 4, true),
    ('entretien-dechets', 'Déchets', 'entretien', 5, true),
    ('entretien-insecticides', 'Insecticides', 'entretien', 6, true),
    ('entretien-accessoires', 'Accessoires', 'entretien', 7, true),
    ('cuisine-emballages', 'Emballages', 'cuisine', 1, true),
    ('cuisine-ustensiles', 'Ustensiles', 'cuisine', 2, false),
    ('cuisine-contenants', 'Contenants', 'cuisine', 3, false),
    ('cuisine-vaisselle', 'Vaisselle de table', 'cuisine', 4, false),
    ('electronique-piles', 'Piles', 'electronique', 1, true),
    ('electronique-ampoules', 'Ampoules', 'electronique', 2, true),
    ('electronique-cables', 'Câbles et chargeurs', 'electronique', 3, false),
    ('electronique-appareils', 'Appareils', 'electronique', 4, false),
    ('bebe-couches', 'Couches', 'bebe', 1, true),
    ('bebe-lingettes', 'Lingettes', 'bebe', 2, true),
    ('bebe-soins', 'Soins', 'bebe', 3, true),
    ('bebe-equipement', 'Équipement', 'bebe', 4, false),
    ('sante-medicaments', 'Médicaments', 'sante', 1, true),
    ('sante-premiers-soins', 'Premiers soins', 'sante', 2, true),
    ('maison-bricolage', 'Bricolage', 'maison', 1, false),
    ('maison-decoration', 'Décoration', 'maison', 2, false),
    ('maison-rangement', 'Rangement', 'maison', 3, false),
    ('maison-plantes', 'Plantes', 'maison', 4, false);

-- Articles : suivi « nombre » (paquets, rouleaux, piles) ou « niveau » (flacon entamé, rempli au besoin) ;
-- vide pour un équipement. achat_en_promo : article que le foyer n'achète qu'en promotion.
ALTER TABLE achats.articles ADD COLUMN suivi TEXT CHECK (suivi IN ('nombre', 'niveau'));
ALTER TABLE achats.articles ADD COLUMN achat_en_promo BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN achats.articles.suivi IS 'Suivi en inventaire : nombre (paquets, rouleaux), niveau (flacon entamé) ; vide = pas suivi.';
COMMENT ON COLUMN achats.articles.achat_en_promo IS 'Acheté seulement en promotion : le prix attendu est le prix payé, pas le prix affiché.';

UPDATE achats.articles SET nom = 'Divers (à classer)', categorie_id = 'divers' WHERE id = 'non-alimentaire-a-classer';

INSERT INTO achats.articles (id, nom, categorie_id, unite_ref, suivi, fourre_tout, achat_en_promo) VALUES
    -- Hygiène
    ('papier-toilette', 'Papier toilette', 'hygiene-toilette', 'piece', 'nombre', false, false),
    ('papier-toilette-humide', 'Papier toilette (humide)', 'hygiene-toilette', 'piece', 'nombre', false, false),
    ('mouchoirs', 'Mouchoirs', 'hygiene-toilette', 'piece', 'nombre', false, false),
    ('lingettes', 'Lingettes', 'hygiene-toilette', 'piece', 'nombre', false, false),
    ('gel-douche', 'Gel douche', 'hygiene-corps', 'l', 'niveau', false, false),
    ('savon-mains', 'Savon (mains)', 'hygiene-corps', 'l', 'niveau', false, false),
    ('deodorant-femme', 'Déodorant (femme)', 'hygiene-corps', 'piece', 'nombre', false, true),
    ('deodorant-homme', 'Déodorant (homme)', 'hygiene-corps', 'piece', 'nombre', false, true),
    ('lait-corporel', 'Lait corporel', 'hygiene-corps', 'l', 'niveau', false, true),
    ('shampoing', 'Shampoing', 'hygiene-cheveux', 'l', 'niveau', false, true),
    ('apres-shampoing', 'Après-shampoing', 'hygiene-cheveux', 'l', 'niveau', false, true),
    ('masque-cheveux', 'Masque (cheveux)', 'hygiene-cheveux', 'l', 'niveau', false, false),
    ('huile-cheveux', 'Huile (cheveux)', 'hygiene-cheveux', 'l', 'niveau', false, false),
    ('dentifrice', 'Dentifrice', 'hygiene-dents', 'piece', 'nombre', false, true),
    ('brosse-a-dents', 'Brosse à dents', 'hygiene-dents', 'piece', 'nombre', false, false),
    ('tetes-brosse-a-dents', 'Têtes de brosse à dents', 'hygiene-dents', 'piece', 'nombre', false, false),
    ('fil-dentaire', 'Fil dentaire', 'hygiene-dents', 'piece', 'nombre', false, false),
    ('bain-de-bouche', 'Bain de bouche', 'hygiene-dents', 'l', 'niveau', false, false),
    ('lames-rasoir', 'Lames de rasoir', 'hygiene-rasage', 'piece', 'nombre', false, true),
    ('serviettes-nuit', 'Serviettes hygiéniques (nuit)', 'hygiene-protections', 'piece', 'nombre', false, true),
    ('serviettes-jour', 'Serviettes hygiéniques (jour)', 'hygiene-protections', 'piece', 'nombre', false, true),
    ('cotons', 'Cotons (démaquillants)', 'hygiene-soins', 'piece', 'nombre', false, false),
    ('dissolvant', 'Dissolvant', 'hygiene-soins', 'l', 'niveau', false, false),
    ('vernis', 'Vernis à ongles', 'hygiene-soins', 'piece', 'nombre', false, false),
    ('nettoyant-visage', 'Nettoyant (visage)', 'hygiene-soins', 'l', 'niveau', false, false),
    ('cire-epilation', 'Cire (épilation)', 'hygiene-soins', 'piece', 'nombre', false, false),
    ('hygiene-divers', 'Hygiène (divers)', 'hygiene', 'piece', NULL, true, false),
    -- Entretien
    ('lessive', 'Lessive', 'entretien-linge', 'l', 'niveau', false, true),
    ('adoucissant', 'Adoucissant', 'entretien-linge', 'l', 'niveau', false, true),
    ('detachant', 'Détachant', 'entretien-linge', 'l', 'niveau', false, false),
    ('percarbonate', 'Percarbonate (blanchisseur)', 'entretien-linge', 'kg', 'niveau', false, false),
    ('anticalcaire-lave-linge', 'Anticalcaire (lave-linge)', 'entretien-linge', 'piece', 'nombre', false, false),
    ('liquide-vaisselle', 'Liquide vaisselle', 'entretien-vaisselle', 'l', 'niveau', false, false),
    ('tablettes-lave-vaisselle', 'Tablettes (lave-vaisselle)', 'entretien-vaisselle', 'piece', 'nombre', false, true),
    ('liquide-rincage', 'Liquide de rinçage', 'entretien-vaisselle', 'l', 'niveau', false, false),
    ('sel-regenerant', 'Sel régénérant', 'entretien-vaisselle', 'kg', 'niveau', false, false),
    ('vinaigre-menager', 'Vinaigre ménager', 'entretien-surfaces', 'l', 'niveau', false, false),
    ('eau-de-javel', 'Eau de Javel', 'entretien-surfaces', 'l', 'niveau', false, false),
    ('cristaux-soude', 'Cristaux de soude', 'entretien-surfaces', 'kg', 'niveau', false, false),
    ('savon-noir', 'Savon noir', 'entretien-surfaces', 'l', 'niveau', false, false),
    ('nettoyant-multi-usages', 'Nettoyant (multi-usages)', 'entretien-surfaces', 'l', 'niveau', false, false),
    ('nettoyant-salle-de-bain', 'Nettoyant (salle de bain)', 'entretien-surfaces', 'l', 'niveau', false, false),
    ('nettoyant-vitres', 'Nettoyant (vitres)', 'entretien-surfaces', 'l', 'niveau', false, false),
    ('creme-a-recurer', 'Crème à récurer', 'entretien-surfaces', 'l', 'niveau', false, false),
    ('desinfectant', 'Désinfectant', 'entretien-surfaces', 'l', 'niveau', false, false),
    ('gommes-nettoyantes', 'Gommes nettoyantes', 'entretien-surfaces', 'piece', 'nombre', false, false),
    ('deboucheur', 'Déboucheur', 'entretien-sols-wc', 'l', 'niveau', false, true),
    ('sacs-poubelle-30', 'Sacs poubelle (30 L)', 'entretien-dechets', 'piece', 'nombre', false, false),
    ('sacs-poubelle-50', 'Sacs poubelle (50 L)', 'entretien-dechets', 'piece', 'nombre', false, false),
    ('sacs-poubelle-100', 'Sacs poubelle (100 L)', 'entretien-dechets', 'piece', 'nombre', false, false),
    ('insecticide', 'Insecticide (aérosol)', 'entretien-insecticides', 'piece', 'nombre', false, false),
    ('anti-moustiques', 'Anti-moustiques (diffuseur)', 'entretien-insecticides', 'piece', 'nombre', false, false),
    ('eponges', 'Éponges', 'entretien-accessoires', 'piece', 'nombre', false, false),
    ('gants-menage', 'Gants de ménage', 'entretien-accessoires', 'piece', 'nombre', false, false),
    ('balais', 'Balais et pelles', 'entretien-accessoires', 'piece', NULL, false, false),
    ('entretien-divers', 'Entretien (divers)', 'entretien', 'piece', NULL, true, false),
    -- Cuisine
    ('essuie-tout', 'Essuie-tout', 'cuisine-emballages', 'piece', 'nombre', false, false),
    ('aluminium', 'Papier aluminium', 'cuisine-emballages', 'piece', 'nombre', false, false),
    ('film-etirable', 'Film étirable', 'cuisine-emballages', 'piece', 'nombre', false, false),
    ('papier-cuisson', 'Papier cuisson', 'cuisine-emballages', 'piece', 'nombre', false, false),
    ('sacs-congelation', 'Sacs congélation', 'cuisine-emballages', 'piece', 'nombre', false, false),
    ('barquettes-alu', 'Barquettes aluminium', 'cuisine-emballages', 'piece', 'nombre', false, false),
    ('ustensiles', 'Ustensiles', 'cuisine-ustensiles', 'piece', NULL, true, false),
    ('boites-bocaux', 'Boîtes et bocaux', 'cuisine-contenants', 'piece', NULL, true, false),
    ('vaisselle-table', 'Vaisselle (table)', 'cuisine-vaisselle', 'piece', NULL, true, false),
    ('cuisine-divers', 'Cuisine (divers)', 'cuisine', 'piece', NULL, true, false),
    -- Électronique
    ('piles-aaa', 'Piles (AAA, LR03)', 'electronique-piles', 'piece', 'nombre', false, false),
    ('piles-aa', 'Piles (AA, LR6)', 'electronique-piles', 'piece', 'nombre', false, false),
    ('piles-cr2032', 'Piles (CR2032, AirTag)', 'electronique-piles', 'piece', 'nombre', false, false),
    ('ampoules-e27', 'Ampoules (E27)', 'electronique-ampoules', 'piece', 'nombre', false, false),
    ('cables-chargeurs', 'Câbles et chargeurs', 'electronique-cables', 'piece', NULL, true, false),
    ('electronique-divers', 'Électronique (divers)', 'electronique', 'piece', NULL, true, false),
    -- Bébé
    ('couches', 'Couches', 'bebe-couches', 'piece', 'nombre', false, false),
    ('lingettes-bebe', 'Lingettes (bébé)', 'bebe-lingettes', 'piece', 'nombre', false, false),
    ('bebe-divers', 'Bébé (divers)', 'bebe', 'piece', NULL, true, false),
    -- Santé
    ('pansements', 'Pansements', 'sante-premiers-soins', 'piece', 'nombre', false, false),
    ('tests-grossesse', 'Tests de grossesse', 'sante', 'piece', 'nombre', false, false),
    ('sante-divers', 'Santé (divers)', 'sante', 'piece', NULL, true, false),
    -- Maison
    ('colles', 'Colles', 'maison-bricolage', 'piece', NULL, false, false),
    ('rubans-adhesifs', 'Rubans adhésifs', 'maison-bricolage', 'piece', NULL, false, false),
    ('lubrifiant', 'Lubrifiant (WD-40)', 'maison-bricolage', 'piece', NULL, false, false),
    ('visserie', 'Visserie', 'maison-bricolage', 'piece', NULL, true, false),
    ('outils', 'Outils', 'maison-bricolage', 'piece', NULL, true, false),
    ('decorations-noel', 'Décorations (Noël)', 'maison-decoration', 'piece', NULL, true, false),
    ('papier-cadeau', 'Papier cadeau', 'maison-decoration', 'piece', NULL, false, false),
    ('boites-rangement', 'Boîtes de rangement', 'maison-rangement', 'piece', NULL, true, false),
    ('plantes', 'Plantes', 'maison-plantes', 'piece', NULL, true, false),
    ('maison-divers', 'Maison (divers)', 'maison', 'piece', NULL, true, false),
    -- Animaux et divers
    ('animaux-divers', 'Animaux (divers)', 'animaux', 'piece', NULL, true, false),
    ('sacs-courses', 'Sacs de courses', 'divers', 'piece', NULL, false, false),
    ('papier-a4', 'Papier (A4)', 'divers', 'piece', 'nombre', false, false),
    ('fournitures-bureau', 'Fournitures de bureau', 'divers', 'piece', NULL, true, false),
    ('remises-ticket', 'Remises (lignes de ticket)', 'divers', 'piece', NULL, true, false);

-- Inventaire : ce qu'il reste à la maison, hors aliments (ceux-ci restent dans chow.stock).
CREATE SCHEMA maison;
COMMENT ON SCHEMA maison IS 'La maison hors alimentation : inventaire des produits suivis.';
CREATE TABLE maison.inventaire (
    id SERIAL PRIMARY KEY,
    article_id TEXT NOT NULL UNIQUE REFERENCES achats.articles (id),
    quantite NUMERIC CHECK (quantite >= 0),
    niveau TEXT CHECK (niveau IN ('plein', 'à moitié', 'presque vide', 'vide')),
    emplacement TEXT,
    date_maj DATE NOT NULL DEFAULT CURRENT_DATE,
    CHECK ((quantite IS NULL) <> (niveau IS NULL))
);
COMMENT ON TABLE maison.inventaire IS 'Un article suivi par ligne : quantite pour un suivi au nombre, niveau pour un suivi au niveau.';
COMMENT ON COLUMN maison.inventaire.quantite IS 'Nombre d''unités (rouleaux, piles, paquets) pour un article suivi au nombre.';
COMMENT ON COLUMN maison.inventaire.niveau IS 'plein, à moitié, presque vide ou vide, pour un article suivi au niveau.';
COMMENT ON COLUMN maison.inventaire.emplacement IS 'Où il est rangé (salle de bain, cuisine, cellier…).';
