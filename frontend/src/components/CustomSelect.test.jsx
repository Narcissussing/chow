import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import CustomSelect from "./CustomSelect.jsx";

const OPTIONS = [
  { value: "", label: "" },
  { value: "1", label: "Poulet curry" },
  { value: "2", label: "Salade" },
];

function Exemple({ onChange = () => {}, ...props }) {
  const [valeur, setValeur] = useState("");
  return (
    <div data-testid="carte" onClick={props.surClicCarte}>
      <CustomSelect
        id="selectRecettePlat"
        value={valeur}
        options={OPTIONS}
        onChange={(v) => {
          setValeur(v);
          onChange(v);
        }}
        {...props}
      />
    </div>
  );
}

const liste = () => document.querySelector(".custom-select__list");

test("structure : select natif suivi immédiatement du bouton (sélecteurs CSS en +)", () => {
  render(<Exemple ariaLabel="Remplacer la cuisine du jour par une recette" />);
  const select = document.getElementById("selectRecettePlat");
  expect(select).toHaveClass("custom-select-native");
  expect(select.nextElementSibling).toHaveClass("custom-select");
  expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Remplacer la cuisine du jour par une recette");
  expect(liste()).toBeNull();
});

test("ouverture sous body, option vide masquée, choix → change puis fermeture en 150 ms", () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  render(<Exemple onChange={onChange} />);
  fireEvent.click(screen.getByRole("button"));
  expect(liste().parentElement).toBe(document.body);
  expect(liste()).toHaveAttribute("data-for-select", "selectRecettePlat");
  expect(liste()).toHaveClass("custom-select__list--ouverte");
  expect(within(liste()).getAllByRole("option").map((o) => o.textContent)).toEqual(["Poulet curry", "Salade"]);

  fireEvent.click(within(liste()).getByText("Salade"));
  expect(onChange).toHaveBeenCalledWith("2");
  expect(screen.getByRole("button")).toHaveTextContent("Salade");
  expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  expect(liste()).not.toBeNull();
  act(() => jest.advanceTimersByTime(150));
  expect(liste()).toBeNull();
  jest.useRealTimers();
});

test("un clic dans la liste ne remonte pas jusqu'à la carte parente (portail)", () => {
  const surClicCarte = jest.fn();
  render(<Exemple surClicCarte={surClicCarte} />);
  fireEvent.click(screen.getByRole("button"));
  fireEvent.click(within(liste()).getByText("Poulet curry"));
  expect(surClicCarte).not.toHaveBeenCalled();
});

test("fermeture instantanée : clic ailleurs, Échap, défilement de la page ; pas le défilement interne", () => {
  render(<Exemple />);
  const ouvrir = () => fireEvent.click(screen.getByRole("button"));

  ouvrir();
  fireEvent.click(document.body);
  expect(liste()).toBeNull();

  ouvrir();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(liste()).toBeNull();

  ouvrir();
  fireEvent.scroll(liste());
  expect(liste()).not.toBeNull();
  fireEvent.scroll(window);
  expect(liste()).toBeNull();
});

test("un seul menu ouvert à la fois", () => {
  render(
    <>
      <Exemple />
      <CustomSelect id="autre" value="" options={OPTIONS} onChange={() => {}} />
    </>
  );
  const [premier, second] = screen.getAllByRole("button");
  fireEvent.click(premier);
  fireEvent.click(second);
  expect(document.querySelectorAll(".custom-select__list")).toHaveLength(1);
  expect(liste()).toHaveAttribute("data-for-select", "autre");
});

test("désactivé : titre reporté, aucune ouverture", () => {
  render(<Exemple disabled title="Aucune recette de plat pour le moment" />);
  const bouton = screen.getByRole("button");
  expect(bouton).toBeDisabled();
  expect(bouton).toHaveAttribute("title", "Aucune recette de plat pour le moment");
  expect(document.querySelector(".custom-select")).toHaveClass("custom-select--disabled");
  fireEvent.click(bouton);
  expect(liste()).toBeNull();
});
