import { api } from "../../api.js";
import { afficherToast } from "../../toast.js";

// Port de fetchAvecRetry : un seul réessai après 800 ms, y compris sur un statut non 2xx (§3.2-16).
export async function fetchAvecRetry(chemin, options, tentativesRestantes = 1) {
  try {
    const { statut, donnees } = await api(chemin, { method: "POST", ...options });
    if (statut < 200 || statut >= 300) throw new Error("HTTP " + statut);
    return donnees;
  } catch (err) {
    // Session expirée (Q3) ou page quittée : ni réessai ni toast.
    if (err.type === "session" || err.type === "annulation") throw err;
    if (tentativesRestantes > 0) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return fetchAvecRetry(chemin, options, tentativesRestantes - 1);
    }
    throw err;
  }
}

// Sans ça, un fetch qui échoue en silence (wifi du magasin) laisse le tap sans aucun retour.
export function gererErreurReseau(err) {
  if (err?.type === "session" || err?.type === "annulation") return;
  console.error("Erreur réseau :", err);
  afficherToast("Connexion instable : réessaie dans un instant.");
}
