-- Magasins choisis pour un aliment : rangés sur l'aliment lui-même. achats.enseignes_habituelles ne garde que les
-- articles qui ne sont pas des aliments (papier toilette, essuie-tout).
CREATE TABLE chow.aliments_enseignes (
    aliment_id VARCHAR NOT NULL REFERENCES chow.aliments (id) ON DELETE CASCADE ON UPDATE CASCADE,
    enseigne_id TEXT NOT NULL REFERENCES achats.enseignes (id),
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (aliment_id, enseigne_id)
);

CREATE TEMP TABLE avant_deplacement ON COMMIT DROP AS
SELECT (SELECT count(*) FROM achats.enseignes_habituelles) AS total,
       (SELECT count(*) FROM achats.enseignes_habituelles h WHERE EXISTS (SELECT 1 FROM chow.aliments a WHERE a.article_id = h.article_id)) AS aliments;

INSERT INTO chow.aliments_enseignes (aliment_id, enseigne_id, cree_le)
SELECT a.id, h.enseigne_id, h.cree_le
FROM achats.enseignes_habituelles h
JOIN chow.aliments a ON a.article_id = h.article_id;

DELETE FROM achats.enseignes_habituelles h
WHERE EXISTS (SELECT 1 FROM chow.aliments a WHERE a.article_id = h.article_id);

-- Contrôle : chaque choix d'un aliment a été déplacé, les autres sont restés, rien n'est perdu.
DO $$
DECLARE avant RECORD;
BEGIN
    SELECT * INTO avant FROM avant_deplacement;
    IF (SELECT count(*) FROM chow.aliments_enseignes) <> avant.aliments
       OR (SELECT count(*) FROM achats.enseignes_habituelles) <> avant.total - avant.aliments THEN
        RAISE EXCEPTION 'Magasins des aliments : déplacement incomplet';
    END IF;
END $$;
