import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { rendreApp, simulerApi } from "./testUtils.jsx";

const DONNEES = {
  "/session": [200, { utilisateur: { id: 1 } }],
  "/courses": [200, { courses: [], aliments: [], stock: [], presetHebdo: [] }],
  "/stock": [200, { stock: [], aliments: [] }],
  "/aliments": [200, { aliments: [] }],
  "/calories": [200, { journal: [], aliments: [], recettes: [] }],
};
const aller = (texte) => act(async () => fireEvent.click([...document.querySelectorAll(".nav__link")].find((l) => l.textContent === texte)));
const attendrePage = () => screen.findByText("Chow — Fait maison 🏠");

afterEach(() => localStorage.clear());

test("quitter Courses en mode magasin retire la classe du body", async () => {
  localStorage.setItem("modeMagasin", "true");
  simulerApi(DONNEES);
  rendreApp("/courses");
  await attendrePage();
  expect(document.body).toHaveClass("mode-magasin");
  await aller("Stock");
  await attendrePage();
  expect(document.body).not.toHaveClass("mode-magasin");
});

test("panneau recette ouvert : la page derrière est figée, et tout est libéré en quittant Calories", async () => {
  simulerApi(DONNEES);
  rendreApp("/calories");
  await attendrePage();
  fireEvent.click(screen.getByRole("button", { name: "Recettes" }));
  fireEvent.click(document.querySelector(".btn-nouvelle-recette"));
  expect(document.getElementById("sheet")).toHaveClass("ouvert");
  expect(document.body.style.overflow).toBe("hidden");
  expect(document.documentElement.style.overflow).toBe("hidden");
  await aller("Aliments");
  await attendrePage();
  expect(document.body.style.overflow).toBe("");
  expect(document.documentElement.style.overflow).toBe("");
  expect(document.getElementById("sheet")).toBeNull();
});

test("naviguer entre toutes les pages ne laisse aucun écouteur document en trop", async () => {
  simulerApi(DONNEES);
  const ajouts = jest.spyOn(document, "addEventListener");
  const retraits = jest.spyOn(document, "removeEventListener");
  const { unmount } = rendreApp("/stock");
  await attendrePage();
  for (const page of ["Courses", "Calories", "Aliments", "Stock", "Courses"]) {
    await aller(page);
    await attendrePage();
  }
  unmount();
  const solde = (type) =>
    ajouts.mock.calls.filter(([t]) => t === type).length - retraits.mock.calls.filter(([t]) => t === type).length;
  expect([solde("click"), solde("keydown"), solde("blur")]).toEqual([0, 0, 0]);
  ajouts.mockRestore();
  retraits.mockRestore();
});

test("aucune écriture serveur au montage d'une page (StrictMode compris)", async () => {
  simulerApi(DONNEES);
  rendreApp("/courses");
  await attendrePage();
  await aller("Calories");
  await attendrePage();
  const ecritures = global.fetch.mock.calls.filter(([, options]) => options?.method && options.method !== "GET");
  expect(ecritures).toEqual([]);
});

test("frontière d'erreur : un rendu qui plante affiche le message, pas une page blanche", () => {
  const erreurConsole = jest.spyOn(console, "error").mockImplementation(() => {});
  function Casse() {
    throw new Error("rendu impossible");
  }
  render(
    <MemoryRouter>
      <ErrorBoundary>
        <Casse />
      </ErrorBoundary>
    </MemoryRouter>
  );
  expect(screen.getByText("Erreur serveur. Recharge la page.")).toBeInTheDocument();
  erreurConsole.mockRestore();
});
