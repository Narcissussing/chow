import { act, fireEvent, render, screen } from "@testing-library/react";
import PanierMagasin, { rayonsDuPanier } from "./PanierMagasin.jsx";

const LIGNES = [
  { id: 1, nom: "Lait", rayon: "Laitiers", achete: true, prevu: 8, valeur: 8, enseigne: "Leclerc" },
  { id: 2, nom: "Yaourt", rayon: "Laitiers", achete: true, prevu: 3, valeur: 15, enseigne: "Leclerc" },
  { id: 3, nom: "Tomate", rayon: "Légumes", achete: false, prevu: 9, valeur: null },
  { id: 4, nom: "Shampoing", rayon: "Maison", achete: false, prevu: 5, valeur: null },
  { id: 5, nom: "Pain burger", rayon: "Autres", achete: false, prevu: null, valeur: null },
];

test("rayons : prévu et chariot par rayon, les articles sans prix sont ignorés", () => {
  expect(rayonsDuPanier(LIGNES)).toEqual([
    { rayon: "Laitiers", prevu: 11, valeur: 23, articles: 2, achetes: 2 },
    { rayon: "Légumes", prevu: 9, valeur: 0, articles: 1, achetes: 0 },
    { rayon: "Maison", prevu: 5, valeur: 0, articles: 1, achetes: 0 },
  ]);
});

test("panier vide : 0 € et le prévu au bout de la piste", () => {
  render(<PanierMagasin lignes={LIGNES.map((l) => ({ ...l, achete: false, valeur: null }))} />);
  expect(screen.getByRole("img")).toHaveAccessibleName("0 € au chariot sur 25 € prévus");
  expect(document.querySelector(".panier__prevu")).not.toHaveClass("efface");
  expect(document.querySelector(".panier__depassement")).not.toHaveClass("visible");
});

test("dépassé : repère du prévu, pastille +N €, prévu effacé", () => {
  render(<PanierMagasin lignes={[...LIGNES, { id: 6, nom: "Chips", rayon: "Épicerie", achete: true, prevu: 1, valeur: 20 }]} />);
  expect(document.querySelector(".panier__repere")).not.toBeNull();
  expect(document.querySelector(".panier__depassement")).toHaveClass("visible");
  expect(document.querySelector(".panier__prevu")).toHaveClass("efface");
});

test("toucher une part : bulle avec le rayon, les autres s'estompent", () => {
  render(<PanierMagasin lignes={LIGNES} />);
  fireEvent.click(screen.getByRole("button", { name: "Laitiers : 23 €" }));
  expect(screen.getByRole("status")).toHaveTextContent("Laitiers23 € sur 11 € · 2 sur 2");
});

test("deux touchers font entrer le ✓ ; Oui termine la tournée", async () => {
  const onTerminer = jest.fn();
  render(<PanierMagasin lignes={LIGNES} onTerminer={onTerminer} />);
  const panier = document.querySelector(".panier");
  fireEvent.click(panier);
  fireEvent.click(panier);
  expect(panier).toHaveClass("avec-fin");
  fireEvent.click(screen.getByRole("button", { name: "Terminer les courses" }));
  expect(screen.getByRole("dialog", { name: "Terminer les courses" })).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Oui" })));
  expect(onTerminer).toHaveBeenCalled();
});

test("✓ sorti : un toucher sur le panier ou ailleurs le fait repartir", () => {
  render(<div><PanierMagasin lignes={LIGNES} /><button type="button">ailleurs</button></div>);
  const panier = document.querySelector(".panier");
  fireEvent.click(panier);
  fireEvent.click(panier);
  expect(panier).toHaveClass("avec-fin");
  fireEvent.click(panier);
  expect(panier).not.toHaveClass("avec-fin");
  fireEvent.click(panier);
  fireEvent.click(panier);
  expect(panier).toHaveClass("avec-fin");
  fireEvent.click(screen.getByRole("button", { name: "ailleurs" }));
  expect(panier).not.toHaveClass("avec-fin");
});
