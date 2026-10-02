import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import { rendreApp, simulerApi } from "../testUtils.jsx";
import { canoniser, premiereDifference } from "./normaliser.js";

// Captures produites par `node scripts/capturer-parite.js` (racine) sur la branche Neon dev.
const DOSSIER = __dirname;
const captures = existsSync(DOSSIER) ? readdirSync(DOSSIER).filter((f) => f.endsWith(".generated.json")) : [];

if (captures.length === 0) {
  test.skip("parité EJS/React : aucune capture (lancer node scripts/capturer-parite.js)", () => {});
}

describe.each(captures)("parité EJS/React — %s", (fichier) => {
  const capture = JSON.parse(readFileSync(join(DOSSIER, fichier), "utf8"));

  test("même <main>, même footer, même titre d'onglet", async () => {
    simulerApi({ "/session": [200, { utilisateur: { id: 1, email: "a@b.c" } }], ...capture.api });
    rendreApp(capture.chemin);
    await screen.findByText("Chow — Fait maison 🏠");

    const difference = premiereDifference(canoniser(capture.main), canoniser(document.querySelector("main").outerHTML));
    expect(difference).toBeNull();
    expect(canoniser(document.querySelector("footer").outerHTML)).toEqual(canoniser(capture.footer));
    expect(document.title).toBe(capture.titre);
    for (const [selecteur, html] of Object.entries(capture.extra || {})) {
      expect([selecteur, premiereDifference(canoniser(html), canoniser(document.querySelector(selecteur).outerHTML))]).toEqual([selecteur, null]);
    }
  });
});
