import { act, fireEvent, screen } from "@testing-library/react";
import { rendreApp, simulerApi } from "./testUtils.jsx";

const CONNECTE = { "/session": [200, { utilisateur: { id: 1, email: "a@b.c" } }] };

test("sans session, une page protégée renvoie vers la connexion avec le chemin de retour", async () => {
  simulerApi({ "/session": [401, { erreur: "Non connecté." }] });
  rendreApp("/");
  expect(await screen.findByText("Se connecter")).toBeInTheDocument();
  expect(document.title).toBe("Chow — Connexion");
});

test("l'accueil connecté affiche les quatre cartes et le titre d'onglet", async () => {
  simulerApi(CONNECTE);
  rendreApp("/");
  expect(await screen.findByText("Ton hub alimentaire maison.")).toBeInTheDocument();
  expect(document.querySelectorAll(".home-link-card")).toHaveLength(4);
  expect(document.title).toBe("Chow — Accueil");
  expect(screen.getByText("Chow — Fait maison 🏠")).toBeInTheDocument();
});

test("le lien actif suit le début du chemin (détail aliment inclus)", async () => {
  simulerApi({ "/session": [401, {}] });
  rendreApp("/login");
  await screen.findByText("Se connecter");
  const liens = [...document.querySelectorAll(".nav__link")];
  expect(liens.map((l) => l.textContent)).toEqual(["Aliments", "Stock", "Courses", "Calories"]);
  expect(liens.every((l) => !l.classList.contains("actif"))).toBe(true);
});

test("un mauvais mot de passe affiche l'erreur, un bon renvoie au chemin demandé", async () => {
  let essais = 0;
  simulerApi({
    "/session": [401, {}],
    "/login": () => (++essais === 1 ? [401, { erreur: "Email ou mot de passe incorrect." }] : [200, { succes: true, utilisateur: { id: 1, email: "a@b.c" } }]),
  });
  rendreApp("/login?retour=%2F");
  await screen.findByText("Se connecter");

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "faux" } });
  fireEvent.click(screen.getByText("Se connecter"));
  expect(await screen.findByText("Email ou mot de passe incorrect.")).toBeInTheDocument();
  // Page recréée : champs vidés comme après la redirection EJS.
  expect(screen.getByLabelText("Mot de passe")).toHaveValue("");

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "bon" } });
  fireEvent.click(screen.getByText("Se connecter"));
  expect(await screen.findByText("Ton hub alimentaire maison.")).toBeInTheDocument();
});

test("un chemin de retour externe est ignoré", async () => {
  simulerApi({ "/session": [401, {}], "/login": [200, { succes: true }] });
  rendreApp("/login?retour=%2F%2Fexemple.com");
  await screen.findByText("Se connecter");
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "x" } });
  fireEvent.click(screen.getByText("Se connecter"));
  expect(await screen.findByText("Ton hub alimentaire maison.")).toBeInTheDocument();
});

test("recliquer sur le lien de la page active la recrée (comme un rechargement)", async () => {
  simulerApi(CONNECTE);
  rendreApp("/");
  await screen.findByText("Ton hub alimentaire maison.");
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
