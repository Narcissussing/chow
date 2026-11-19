-- Plusieurs photos de référence par ligne de Courses : une ligne par photo, la colonne unique courses.photo y est déplacée.
CREATE TABLE chow.courses_photos (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES chow.courses (id) ON DELETE CASCADE,
    photo BYTEA NOT NULL,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX courses_photos_course ON chow.courses_photos (course_id, id);

INSERT INTO chow.courses_photos (course_id, photo, cree_le)
SELECT id, photo, COALESCE(date_ajout::timestamptz, now())
FROM chow.courses
WHERE photo IS NOT NULL
ORDER BY id;

-- Contrôle : chaque photo existante a été déplacée, octet pour octet.
DO $$
BEGIN
    IF (SELECT count(*) FROM chow.courses WHERE photo IS NOT NULL) <> (SELECT count(*) FROM chow.courses_photos)
       OR (SELECT COALESCE(sum(octet_length(photo)), 0) FROM chow.courses) <> (SELECT COALESCE(sum(octet_length(photo)), 0) FROM chow.courses_photos) THEN
        RAISE EXCEPTION 'Photos des Courses : déplacement incomplet';
    END IF;
END $$;

ALTER TABLE chow.courses DROP COLUMN photo;
