import { render } from "@testing-library/react";
import { useRef } from "react";
import { useVerrouDefilement } from "./useVerrouDefilement.js";

function Panneau({ ouvert }) {
  const zone = useRef(null);
  useVerrouDefilement(ouvert, zone);
  return (
    <>
      <p id="page">page</p>
      <div ref={zone} id="panneau">panneau</div>
      <ul className="custom-select__list" id="liste"><li>option</li></ul>
    </>
  );
}

const glisser = (id) => {
  const evt = new Event("touchmove", { bubbles: true, cancelable: true });
  document.getElementById(id).dispatchEvent(evt);
  return evt.defaultPrevented;
};

test("panneau ouvert : la page est bloquée, le panneau et les listes de sélecteurs défilent ; tout est rendu à la fermeture", () => {
  const { rerender } = render(<Panneau ouvert />);
  expect(document.body.style.overflow).toBe("hidden");
  expect(glisser("page")).toBe(true);
  expect(glisser("panneau")).toBe(false);
  expect(glisser("liste")).toBe(false);
  rerender(<Panneau ouvert={false} />);
  expect(document.body.style.overflow).toBe("");
  expect(glisser("page")).toBe(false);
});
