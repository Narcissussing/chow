-- Bœuf haché : l'article boeuf-hache-20 (aliment « Boeuf Haché 15% ») est le 15 % Ferial habituel ; il reprend le doublon boeuf-hache-15,
-- et les vrais 20 % (ECO+, Carrefour 20 %, haché moelleux) passent dans leur propre article.
INSERT INTO achats.articles (id, nom, categorie_id, unite_ref) VALUES ('boeuf-hache-20-mg', 'Bœuf haché 20 %', 'alimentation-viandes', 'kg')
ON CONFLICT (id) DO NOTHING;

UPDATE achats.produits SET article_id = 'boeuf-hache-20-mg'
WHERE article_id IN ('boeuf-hache-20', 'boeuf-hache-15') AND libelle ~* '20 ?%|ECO\+|MOELLEUX';

UPDATE achats.produits SET article_id = 'boeuf-hache-20' WHERE article_id = 'boeuf-hache-15';

DO $$
BEGIN
    IF to_regclass('ancien.libelles') IS NOT NULL THEN
        UPDATE ancien.libelles SET food_id = 'boeuf-hache-20' WHERE food_id = 'boeuf-hache-15';
    END IF;
    -- Le doublon disparaît s'il n'est plus utilisé nulle part ; sinon il reste, sans bloquer le démarrage.
    BEGIN
        DELETE FROM chow.aliments WHERE id = 'boeuf-hache-15';
        DELETE FROM achats.articles WHERE id = 'boeuf-hache-15';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    IF EXISTS (SELECT 1 FROM achats.produits WHERE article_id = 'boeuf-hache-20' AND libelle ~* '20 ?%|ECO\+') THEN
        RAISE EXCEPTION 'Bœuf haché : des produits 20 %% restent dans le 15 %%';
    END IF;
END $$;
