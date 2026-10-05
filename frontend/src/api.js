import { afficherToast } from "./toast.js";

export class ErreurApi extends Error {
  constructor(type, message) {
    super(message);
    this.type = type;
  }
}

let sessionExpireeSignalee = false;

function signalerSessionExpiree() {
  if (sessionExpireeSignalee) return;
  sessionExpireeSignalee = true;
  afficherToast("Ta session a expiré. Reconnecte-toi.");
  setTimeout(() => window.location.reload(), 1500);
}

export async function api(chemin, { method = "GET", body, signal, ignorer401 = false } = {}) {
  const envoieCorps = method !== "GET";
  let reponse;
  try {
    reponse = await fetch("/api" + chemin, {
      method,
      signal,
      credentials: "same-origin",
      headers: envoieCorps ? { "Content-Type": "application/json" } : undefined,
      body: envoieCorps ? JSON.stringify(body ?? {}) : undefined,
    });
  } catch (err) {
    throw new ErreurApi(err.name === "AbortError" ? "annulation" : "reseau", err.message);
  }

  if (reponse.status === 401 && !ignorer401) {
    signalerSessionExpiree();
    throw new ErreurApi("session", "Session expirée");
  }

  let donnees = null;
  try {
    donnees = await reponse.json();
  } catch {
  }
  return { statut: reponse.status, donnees };
}

export function reinitialiserSessionPourTests() {
  sessionExpireeSignalee = false;
}
