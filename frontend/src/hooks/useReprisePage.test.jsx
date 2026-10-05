import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { reinitialiserReprisePourTests, useReprisePage } from "./useReprisePage.js";

function Coquille() {
  useReprisePage();
  return (
    <>
      <p data-testid="chemin">{useLocation().pathname}</p>
      <Link to="/">Accueil</Link>
    </>
  );
}

function ouvrirSur(chemin) {
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="*" element={<Coquille />} />
      </Routes>
    </MemoryRouter>
  );
}

const derniere = (chemin, ilYaMinutes) => localStorage.setItem("chow-derniere-page", JSON.stringify({ chemin, quand: Date.now() - ilYaMinutes * 60 * 1000 }));

beforeEach(() => reinitialiserReprisePourTests());
afterEach(() => localStorage.clear());

test("relance sur l'accueil : rouvre la dernière page de moins d'1 h ; « Accueil » ensuite reste l'accueil", () => {
  derniere("/courses", 10);
  ouvrirSur("/");
  expect(screen.getByTestId("chemin").textContent).toBe("/courses");
  fireEvent.click(screen.getByText("Accueil"));
  expect(screen.getByTestId("chemin").textContent).toBe("/");
});

test("dernière page de plus d'1 h : on reste sur l'accueil", () => {
  derniere("/stock", 120);
  ouvrirSur("/");
  expect(screen.getByTestId("chemin").textContent).toBe("/");
});

test("ouverture directe d'une autre page : aucune reprise", () => {
  derniere("/courses", 5);
  ouvrirSur("/stock");
  expect(screen.getByTestId("chemin").textContent).toBe("/stock");
});

test("adresse inconnue (ex. /cart d'un autre projet) : ni gardée ni reprise", () => {
  derniere("/cart", 5);
  ouvrirSur("/");
  expect(screen.getByTestId("chemin").textContent).toBe("/");
  reinitialiserReprisePourTests();
  localStorage.clear();
  derniere("/courses", 5);
  ouvrirSur("/cart");
  expect(JSON.parse(localStorage.getItem("chow-derniere-page")).chemin).toBe("/courses");
});
