import { act, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { useGlisserPourFermer } from "./useGlisserPourFermer.js";

function Feuille({ onFermer, defile = false }) {
  const ref = useRef(null);
  useGlisserPourFermer(ref, onFermer);
  return (
    <div ref={ref} data-testid="feuille">
      <header data-entete-feuille data-testid="entete">Titre</header>
      <div data-testid="contenu" ref={(el) => el && defile && Object.defineProperties(el, { scrollTop: { value: 40 }, scrollHeight: { value: 900 }, clientHeight: { value: 300 } })}>
        Contenu
      </div>
    </div>
  );
}

const toucher = (el, y) => [{ clientY: y, target: el }];
function glisser(el, de, a) {
  fireEvent.touchStart(el, { touches: toucher(el, de) });
  fireEvent.touchMove(el, { touches: toucher(el, a) });
  fireEvent.touchEnd(el, { touches: [] });
}

beforeEach(() => {
  jest.useFakeTimers();
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
});
afterEach(() => jest.useRealTimers());

test("tirer une feuille vers le bas la ferme, un petit geste la remet en place", () => {
  const onFermer = jest.fn();
  const { getByTestId } = render(<Feuille onFermer={onFermer} />);
  glisser(getByTestId("contenu"), 100, 130);
  act(() => jest.advanceTimersByTime(600));
  expect(onFermer).not.toHaveBeenCalled();
  expect(getByTestId("feuille").style.transform).toBe("");

  glisser(getByTestId("contenu"), 100, 400);
  act(() => jest.advanceTimersByTime(250));
  expect(onFermer).toHaveBeenCalledTimes(1);
});

test("un contenu déjà descendu défile au lieu de fermer, sauf depuis l'en-tête", () => {
  const onFermer = jest.fn();
  const { getByTestId } = render(<Feuille onFermer={onFermer} defile />);
  glisser(getByTestId("contenu"), 100, 400);
  act(() => jest.advanceTimersByTime(250));
  expect(onFermer).not.toHaveBeenCalled();

  glisser(getByTestId("entete"), 100, 400);
  act(() => jest.advanceTimersByTime(250));
  expect(onFermer).toHaveBeenCalledTimes(1);
});
