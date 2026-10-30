-- Les Courses acceptent aussi un article du catalogue maison (shampoing, javel), en attendant la liste universelle.
ALTER TABLE chow.courses ADD COLUMN article_id TEXT REFERENCES achats.articles (id);
ALTER TABLE chow.courses ADD CONSTRAINT courses_aliment_ou_article CHECK (food_id IS NULL OR article_id IS NULL);
