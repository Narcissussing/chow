-- Étapes du Sushi raccourcies, en anglais, comme les autres recettes ; inchangées si elles ont été modifiées dans l'app.
UPDATE chow.recettes
SET etapes = E'Rinse rice till water is clear\nCook rice\nMix rice vinegar, sugar and salt\nPour on hot rice and let cool\nCut veggies, surimi and fish in sticks\nLay nori on bamboo mat\nSpread rice on nori\nAdd cream cheese and sticks\nRoll tight and cut in 8\nServe with wasabi and ginger'
WHERE nom = 'Sushi'
  AND etapes = E'Rincer le riz jusqu''à ce que l''eau soit claire, puis le cuire\nMélanger vinaigre de riz, sucre et sel, verser sur le riz chaud et laisser tiédir\nCouper concombre, carotte, avocat, surimi et poisson en bâtonnets\nÉtaler le riz sur une feuille de nori posée sur le rouleau en bambou\nGarnir d''un trait de fromage à tartiner et des bâtonnets\nRouler en serrant, couper en 8\nServir avec wasabi et gingembre mariné';
