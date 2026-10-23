import { act, fireEvent, screen } from "@testing-library/react";
import { rendreApp, simulerApi } from "./testUtils.jsx";

const ACCUEIL = { "/accueil": [200, { stock: 42, courses: 7, depense_mois: 412.3, depense_semaine: 52, depense_mois_dernier: 545, stock_a_verifier: 5, semaines: [{ debut: "2026-10-12", total: 120 }, { debut: "2026-10-19", total: 52 }], aVerifier: [{ id: 3, nom: "Riz", emoji: "🍚", jours: 35 }], estimation: { estimation: 19 } }] };
const CONNECTE = { "/session": [200, { utilisateur: { id: 1, email: "a@b.c" } }], ...ACCUEIL };

test("sans session, une page protégée renvoie vers la connexion avec le chemin de retour", async () => {
  simulerApi({ "/session": [401, { erreur: "Non connecté." }] });
  rendreApp("/");
  expect(await screen.findByText("Se connecter")).toBeInTheDocument();
  expect(document.title).toBe("Chow — Connexion");
});

test("l'accueil connecté affiche Stats, Stock et Courses chiffrés", async () => {
  simulerApi({ ...CONNECTE, ...ACCUEIL });
  rendreApp("/");
  expect(await screen.findByText("412 €")).toBeInTheDocument();
  expect(document.querySelectorAll(".home-link-card")).toHaveLength(3);
  expect(screen.getByText("à acheter · ≈ 19 €")).toBeInTheDocument();
  expect(screen.getByText("52 € cette semaine")).toBeInTheDocument();
  expect(screen.getByText("545 € le mois dernier")).toBeInTheDocument();
  expect(screen.getByText("à la maison · 5 à vérifier")).toBeInTheDocument();
  expect(screen.getByText("Riz")).toBeInTheDocument();
  expect(screen.getByText("5 sem.")).toBeInTheDocument();
  expect(document.title).toBe("Chow — Accueil");
  expect(screen.queryByText("Paramètres")).not.toBeInTheDocument();
});

test("accueil : « Fini » vide un article à vérifier et le retire de la liste", async () => {
  const corps = [];
  simulerApi({ ...CONNECTE, "/stock/verifier": (o) => { corps.push(JSON.parse(o.body)); return [200, { succes: true, quantite: "0" }]; } });
  rendreApp("/");
  expect(await screen.findByText("Riz")).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByText("Fini")));
  expect(corps).toEqual([{ idStock: 3, fini: true }]);
  expect(screen.queryByText("Riz")).not.toBeInTheDocument();
  expect(screen.getByText("à la maison · 4 à vérifier")).toBeInTheDocument();
});

test("Paramètres : lien dans le pied de page et page ouverte pour l'admin seulement", async () => {
  simulerApi({ "/session": [200, { utilisateur: { id: 1, admin: true } }], ...ACCUEIL, "/aliments": [200, { aliments: [{ id: "a" }, { id: "b" }] }] });
  rendreApp("/");
  const lien = await screen.findByRole("link", { name: "Paramètres" });
  await act(async () => fireEvent.click(lien));
  expect(await screen.findByText("Visible seulement par l’administrateur.")).toBeInTheDocument();
  expect(screen.getByText("2")).toBeInTheDocument();
});

test("Paramètres refusés à un compte non admin : retour à l'accueil", async () => {
  simulerApi({ ...CONNECTE, ...ACCUEIL });
  rendreApp("/parametres/aliments");
  expect(await screen.findByText("412 €")).toBeInTheDocument();
});

test("le lien actif suit le début du chemin (détail aliment inclus)", async () => {
  simulerApi({ "/session": [401, {}] });
  rendreApp("/login");
  await screen.findByText("Se connecter");
  const liens = [...document.querySelectorAll(".nav__link")];
  expect(liens.map((l) => l.textContent)).toEqual(["Stats", "Stock", "Courses", "Calories"]);
  expect(liens.every((l) => !l.classList.contains("actif"))).toBe(true);
});

test("un mauvais mot de passe affiche l'erreur, un bon renvoie au chemin demandé", async () => {
  let essais = 0;
  simulerApi({
    "/session": [401, {}],
    "/login": () => (++essais === 1 ? [401, { erreur: "Email ou mot de passe incorrect." }] : [200, { succes: true, utilisateur: { id: 1, email: "a@b.c" } }]),
    ...ACCUEIL,
  });
  rendreApp("/login?retour=%2F");
  await screen.findByText("Se connecter");

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "faux" } });
  fireEvent.click(screen.getByText("Se connecter"));
  expect(await screen.findByText("Email ou mot de passe incorrect.")).toBeInTheDocument();
  expect(screen.getByLabelText("Mot de passe")).toHaveValue("");

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "bon" } });
  fireEvent.click(screen.getByText("Se connecter"));
  expect(await screen.findByText("412 €")).toBeInTheDocument();
});

test("trop d'essais de connexion : message de blocage", async () => {
  simulerApi({ "/session": [401, {}], "/login": [429, { erreur: "Trop d'essais. Connexion bloquée." }] });
  rendreApp("/login");
  await screen.findByText("Se connecter");
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "x" } });
  fireEvent.click(screen.getByText("Se connecter"));
  expect(await screen.findByText("Trop d'essais. Connexion bloquée.")).toBeInTheDocument();
});

test("un chemin de retour externe est ignoré", async () => {
  simulerApi({ "/session": [401, {}], "/login": [200, { succes: true }], ...ACCUEIL });
  rendreApp("/login?retour=%2F%2Fexemple.com");
  await screen.findByText("Se connecter");
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "x" } });
  fireEvent.click(screen.getByText("Se connecter"));
  expect(await screen.findByText("412 €")).toBeInTheDocument();
});

test("recliquer sur le lien de la page active la recrée (comme un rechargement)", async () => {
  simulerApi(CONNECTE);
  rendreApp("/");
  await screen.findByText("412 €");
  const avant = document.querySelector(".home-links");
  await act(async () => fireEvent.click(document.querySelector(".logo")));
  expect(document.querySelector(".home-links")).not.toBe(avant);
});

test("serveur injoignable au démarrage : message d'erreur, pas de page vide", async () => {
  global.fetch = jest.fn(async () => {
    throw new TypeError("Failed to fetch");
  });
  rendreApp("/");
  expect(await screen.findByText("Erreur serveur. Recharge la page.")).toBeInTheDocument();
});

test("serveur arrêté derrière Vite (502) : erreur serveur, jamais « mot de passe incorrect »", async () => {
  simulerApi({ "/session": [401, {}], "/login": [502, null] });
  rendreApp("/login");
  await screen.findByText("Se connecter");
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "bon" } });
  fireEvent.click(screen.getByText("Se connecter"));
  expect(await screen.findByText("Erreur serveur. Recharge la page.")).toBeInTheDocument();
  expect(screen.queryByText("Email ou mot de passe incorrect.")).toBeNull();
});

test("vérification de session en 502 : erreur serveur, pas la page de connexion", async () => {
  simulerApi({ "/session": [502, null] });
  rendreApp("/");
  expect(await screen.findByText("Erreur serveur. Recharge la page.")).toBeInTheDocument();
});
