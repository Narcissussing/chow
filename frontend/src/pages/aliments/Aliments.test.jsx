import { act, fireEvent, screen, within } from "@testing-library/react";
import { rendreApp, simulerApi } from "../../testUtils.jsx";

const ALIMENTS = [
  { id: "cafe", nom: "Café", categorie: "Boissons", calories: "2.00", proteines: "0.30", emoji: "☕" },
  { id: "riz", nom: "Riz", categorie: "Féculents", calories: "130.00", proteines: "2.70", emoji: "🍚" },
  { id: "poulet", nom: "Poulet", categorie: "Viandes", calories: "165.00", proteines: "31.00", emoji: "🍗" },
];

async function ouvrir() {
  simulerApi({ "/session": [200, { utilisateur: { id: 1 } }], "/aliments": [200, { aliments: ALIMENTS }] });
  rendreApp("/aliments");
  await screen.findByText("Chow — Fait maison 🏠");
}
const nomsVisibles = () => [...document.querySelectorAll(".food-card:not(.hidden) .food-card__name")].map((n) => n.textContent);
const champ = () => document.getElementById("searchInput");

test("recherche sans accents : « cafe » trouve « Café »", async () => {
  await ouvrir();
  fireEvent.change(champ(), { target: { value: "cafe" } });
  expect(nomsVisibles()).toEqual(["Café"]);
  expect(champ()).not.toHaveClass("recherche-invalide");
});

test("filtre et recherche combinés, état vide et champ rouge", async () => {
  await ouvrir();
  fireEvent.click(screen.getByRole("button", { name: "Viandes" }));
  expect(nomsVisibles()).toEqual(["Poulet"]);
  fireEvent.change(champ(), { target: { value: "riz" } });
  expect(nomsVisibles()).toEqual([]);
  expect(document.getElementById("noResults")).not.toHaveClass("hidden");
  expect(champ()).toHaveClass("recherche-invalide");
  fireEvent.click(screen.getByRole("button", { name: "Tous" }));
  expect(nomsVisibles()).toEqual(["Riz"]);
});

test("tri numérique (pas alphabétique) sur les calories", async () => {
  await ouvrir();
  fireEvent.click(document.querySelector(".sort-wrapper .custom-select__button"));
  fireEvent.click(within(document.querySelector(".custom-select__list")).getByText("Calories ↘"));
  expect(nomsVisibles()).toEqual(["Poulet", "Riz", "Café"]);
});

test("le bouton ✕ vide la recherche", async () => {
  await ouvrir();
  fireEvent.change(champ(), { target: { value: "zz" } });
  const effacer = document.querySelector(".btn-effacer-recherche");
  expect(effacer).toHaveClass("visible");
  await act(async () => fireEvent.click(effacer));
  expect(champ()).toHaveValue("");
  expect(nomsVisibles()).toHaveLength(3);
});
