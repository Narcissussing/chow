import { act, fireEvent, screen } from "@testing-library/react";
import { rendreApp, simulerApi } from "../../testUtils.jsx";

const ALIMENT = { id: "huile", nom: "Huile d'olive", categorie: "Lipides", calories: "884.00", glucides: "0.00", proteines: "0.00", lipides: "100.00", emoji: "🫒", grammes_par_cuil_a_cafe: null, grammes_par_cuil_a_soupe: "13.5" };

test("équivalences : sauvegarde à la sortie du champ, champ vide envoyé vide, « Enregistré » 2 s", async () => {
  jest.useFakeTimers();
  const envois = [];
  simulerApi({
    "/session": [200, { utilisateur: { id: 1 } }],
    "/aliments/huile": [200, { aliment: ALIMENT }],
    "/aliments/huile/equivalences": (options) => {
      envois.push(JSON.parse(options.body));
      return [200, { succes: true }];
    },
  });
  rendreApp("/aliments/huile");
  await act(async () => jest.runOnlyPendingTimers());
  await screen.findByText("Huile d'olive");
  expect(document.title).toBe("Chow — Huile d'olive");
  expect(document.getElementById("equivGrammesCafe")).toHaveValue(null);
  expect(document.getElementById("equivGrammesSoupe")).toHaveValue(13.5);

  const cafe = document.getElementById("equivGrammesCafe");
  fireEvent.input(cafe, { target: { value: "5" } });
  expect(envois).toHaveLength(0);
  await act(async () => fireEvent.change(cafe));
  expect(envois).toEqual([{ grammesCafe: "5", grammesSoupe: "13.5" }]);
  expect(document.getElementById("equivStatut")).not.toHaveClass("hidden");
  act(() => jest.advanceTimersByTime(2000));
  expect(document.getElementById("equivStatut")).toHaveClass("hidden");
  jest.useRealTimers();
});

test("aliment inconnu : message et titre « Aliment introuvable »", async () => {
  simulerApi({ "/session": [200, { utilisateur: { id: 1 } }], "/aliments/x": [404, { erreur: "Aliment introuvable." }] });
  rendreApp("/aliments/x");
  expect(await screen.findByText("Aliment introuvable.")).toBeInTheDocument();
  expect(document.title).toBe("Chow — Aliment introuvable");
});
