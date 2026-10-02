import { api, reinitialiserSessionPourTests } from "./api.js";
import { abonnerToast } from "./toast.js";

beforeEach(() => {
  reinitialiserSessionPourTests();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

test("plusieurs 401 simultanés n'affichent qu'un seul message de session expirée", async () => {
  global.fetch = jest.fn(async () => ({ status: 401, ok: false, json: async () => ({ erreur: "Non connecté." }) }));
  const messages = [];
  const desabonner = abonnerToast((m) => messages.push(m));
  await Promise.allSettled([api("/stock"), api("/courses"), api("/calories")]);
  expect(messages).toEqual(["Ta session a expiré. Reconnecte-toi."]);
  desabonner();
});

test("un POST envoie toujours du JSON, même sans corps (garde 415 côté serveur)", async () => {
  global.fetch = jest.fn(async () => ({ status: 200, ok: true, json: async () => ({ succes: true }) }));
  await api("/recettes/3/supprimer", { method: "POST" });
  const [, options] = global.fetch.mock.calls[0];
  expect(options.headers["Content-Type"]).toBe("application/json");
  expect(options.body).toBe("{}");
});

test("une erreur métier reste dans la réponse, pas en exception", async () => {
  global.fetch = jest.fn(async () => ({ status: 400, ok: false, json: async () => ({ erreur: "Champs requis." }) }));
  const { statut, donnees } = await api("/stock/ajouter", { method: "POST", body: {} });
  expect(statut).toBe(400);
  expect(donnees.erreur).toBe("Champs requis.");
});

test("panne réseau et annulation sont distinguées", async () => {
  global.fetch = jest.fn(async () => {
    throw new TypeError("Failed to fetch");
  });
  await expect(api("/stock")).rejects.toMatchObject({ type: "reseau" });
  global.fetch = jest.fn(async () => {
    throw Object.assign(new Error("aborted"), { name: "AbortError" });
  });
  await expect(api("/stock")).rejects.toMatchObject({ type: "annulation" });
});
