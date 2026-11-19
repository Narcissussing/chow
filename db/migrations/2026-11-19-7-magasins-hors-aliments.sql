-- Articles qui ne sont pas des aliments Chow (maison, hygiène…) : achetés à Leclerc, sauf l'essuie-tout et le papier
-- toilette, achetés à Action (choix d'Olumide, 2026-11-19). Remplace leurs enseignes choisies jusqu'ici.
DELETE FROM achats.enseignes_habituelles h
WHERE NOT EXISTS (SELECT 1 FROM chow.aliments al WHERE al.article_id = h.article_id);

INSERT INTO achats.enseignes_habituelles (article_id, enseigne_id)
SELECT a.id, CASE WHEN a.id IN ('essuie-tout', 'papier-toilette') THEN 'action' ELSE 'leclerc' END
FROM achats.articles a
WHERE NOT a.fourre_tout AND NOT EXISTS (SELECT 1 FROM chow.aliments al WHERE al.article_id = a.id);

DO $$
BEGIN
    IF (SELECT count(*) FROM achats.enseignes_habituelles WHERE enseigne_id = 'action') <> 2
       OR (SELECT count(*) FROM achats.enseignes_habituelles)
          <> (SELECT count(*) FROM achats.articles a WHERE NOT a.fourre_tout AND NOT EXISTS (SELECT 1 FROM chow.aliments al WHERE al.article_id = a.id)) THEN
        RAISE EXCEPTION 'Magasins hors aliments : réglage incomplet';
    END IF;
END $$;
