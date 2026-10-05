import { api } from "../../api.js";
import { afficherToast } from "../../toast.js";

export async function fetchAvecRetry(chemin, options, tentativesRestantes = 1) {
  try {
    const { statut, donnees } = await api(chemin, { method: "POST", ...options });
    if (statut < 200 || statut >= 300) throw new Error("HTTP " + statut);
    return donnees;
  } catch (err) {
    if (err.type === "session" || err.type === "annulation") throw err;
    if (tentativesRestantes > 0) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return fetchAvecRetry(chemin, options, tentativesRestantes - 1);
    }
    throw err;
  }
}

export function gererErreurReseau(err) {
  if (err?.type === "session" || err?.type === "annulation") return;
  console.error("Erreur réseau :", err);
  afficherToast("Connexion instable : réessaie dans un instant.");
}
