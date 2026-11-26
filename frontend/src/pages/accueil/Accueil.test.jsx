import { fireEvent, screen, waitFor } from "@testing-library/react";
import { rendreApp, simulerApi } from "../../testUtils.jsx";
import { salutation } from "./Accueil.jsx";

test("salutation selon l'heure", () => {
  expect(salutation(8)).toBe("Bonjour");
  expect(salutation(15)).toBe("Bonjour");
  expect(salutation(18)).toBe("Bonsoir");
  expect(salutation(23)).toBe("Bonsoir");
  expect(salutation(3)).toBe("Bonsoir");
  expect(salutation(5)).toBe("Bonjour");
});

const ACCUEIL = {
  stock: 2, stock_a_verifier: 2, courses: 0, depense_mois: 0, depense_semaine: 0, depense_mois_dernier: 0,
  semaines: [], estimation: { estimation: 0 },
  aVerifier: [
    { id: 1, food_id: "lait", nom: "Lait", emoji: "🥛", quantite: "à moitié", tracking_type: "cl", jours: 21, deja_en_courses: false },
    { id: 2, food_id: "riz", nom: "Riz", emoji: "🍚", quantite: "1", tracking_type: "pack", jours: 21, deja_en_courses: true },
  ],
};

function ouvrirAccueil() {
  const requetes = [];
  const noter = (chemin, reponse) => (options) => {
    requetes.push({ chemin, corps: JSON.parse(options.body) });
    return reponse;
  };
  simulerApi({
    "/session": [200, { utilisateur: { id: 1 } }],
    "/accueil": [200, ACCUEIL],
    "/stock/verifier": noter("/stock/verifier", [200, { succes: true }]),
    "/stock/modifier": noter("/stock/modifier", [200, { succes: true }]),
    "/courses/ajouter": noter("/courses/ajouter", [200, { succes: true, item: {} }]),
  });
  rendreApp("/");
  return requetes;
}

test("fini ou presque : proposé aux Courses, sauf s'il y est déjà", async () => {
  const requetes = ouvrirAccueil();
  fireEvent.click(await screen.findByRole("button", { name: "Lait : fini" }));
  expect(await screen.findByText("Aux Courses ?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ajouter Lait aux Courses" }));
  await waitFor(() => expect(requetes).toContainEqual({ chemin: "/courses/ajouter", corps: { idAliment: "lait" } }));

  fireEvent.click(screen.getByRole("button", { name: "Riz : fini" }));
  expect(screen.queryAllByText("Aux Courses ?")).toHaveLength(0);
});

test("niveau bas choisi : proposé aux Courses, « Pas maintenant » n'ajoute rien", async () => {
  const requetes = ouvrirAccueil();
  fireEvent.click(await screen.findByRole("button", { name: "Modifier la quantité de Lait" }));
  fireEvent.click(screen.getByRole("button", { name: "Presque vide" }));
  expect(await screen.findByText("Aux Courses ?")).toBeInTheDocument();
  expect(requetes).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Pas maintenant" }));
  expect(screen.queryByText("Aux Courses ?")).not.toBeInTheDocument();
  await waitFor(() => expect(requetes).toEqual([{ chemin: "/stock/modifier", corps: { idStock: 1, nouvelleQuantite: "presque vide" } }]));
});

test("toucher ailleurs annule la question sans rien enregistrer, même en passant à un autre aliment", async () => {
  const requetes = ouvrirAccueil();
  fireEvent.click(await screen.findByRole("button", { name: "Lait : fini" }));
  expect(await screen.findByText("Aux Courses ?")).toBeInTheDocument();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByText("Aux Courses ?")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Lait : fini" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Lait : fini" }));
  const riz = screen.getByRole("button", { name: "Riz : toujours là" });
  fireEvent.pointerDown(riz);
  fireEvent.click(riz);
  await waitFor(() => expect(requetes).toEqual([{ chemin: "/stock/verifier", corps: { idStock: 2, fini: false } }]));
  expect(screen.getByRole("button", { name: "Lait : fini" })).toBeInTheDocument();
});
