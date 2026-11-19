const PHOTO_TAILLE_MAX = 1600;
const PHOTO_QUALITE = 0.9;

export function compresserImage(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const image = new Image();
      image.onload = () => {
        let largeur = image.width;
        let hauteur = image.height;
        if (largeur > hauteur && largeur > PHOTO_TAILLE_MAX) {
          hauteur = Math.round((hauteur * PHOTO_TAILLE_MAX) / largeur);
          largeur = PHOTO_TAILLE_MAX;
        } else if (hauteur > PHOTO_TAILLE_MAX) {
          largeur = Math.round((largeur * PHOTO_TAILLE_MAX) / hauteur);
          hauteur = PHOTO_TAILLE_MAX;
        }
        const canvas = document.createElement("canvas");
        canvas.width = largeur;
        canvas.height = hauteur;
        canvas.getContext("2d").drawImage(image, 0, 0, largeur, hauteur);
        resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITE).split(",")[1]);
      };
      image.onerror = reject;
      image.src = lecteur.result;
    };
    lecteur.onerror = reject;
    lecteur.readAsDataURL(fichier);
  });
}

// Cache local des photos (le magasin capte mal) : une entrée par photo, sous son identifiant serveur.
const cle = (idPhoto) => "chow-photo-" + idPhoto;
const ANCIENNE_CLE = "chow-photo-course-";

export function sauvegarderPhotoLocale(idPhoto, base64) {
  try {
    localStorage.setItem(cle(idPhoto), base64);
  } catch (err) {
    console.warn("Impossible de garder la photo en cache locale :", err);
  }
}

export function lirePhotoLocale(idPhoto) {
  try {
    return localStorage.getItem(cle(idPhoto));
  } catch {
    return null;
  }
}

export function supprimerPhotoLocale(idPhoto) {
  try {
    localStorage.removeItem(cle(idPhoto));
  } catch {
  }
}

// Source d'une photo : le cache local s'il l'a, sinon le serveur.
export function srcPhoto(idPhoto) {
  const locale = lirePhotoLocale(idPhoto);
  return locale ? "data:image/jpeg;base64," + locale : `/api/courses/photos/${idPhoto}`;
}

// Les caches d'avant (une photo par ligne de Courses) ne servent plus.
function oublierAnciensCaches() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(ANCIENNE_CLE)).forEach((k) => localStorage.removeItem(k));
  } catch {
  }
}

export function synchroniserPhotosLocales(idsPhotos) {
  oublierAnciensCaches();
  idsPhotos.forEach((idPhoto) => {
    if (lirePhotoLocale(idPhoto)) return;
    fetch(`/api/courses/photos/${idPhoto}`, { credentials: "same-origin" })
      .then((reponse) => {
        if (!reponse.ok) throw new Error("photo introuvable");
        return reponse.blob();
      })
      .then((blob) => {
        const lecteur = new FileReader();
        lecteur.onload = () => sauvegarderPhotoLocale(idPhoto, lecteur.result.split(",")[1]);
        lecteur.readAsDataURL(blob);
      })
      .catch(() => {
      });
  });
}

export function cleArticlePreset(foodId, nom, articleId) {
  return foodId ? "f:" + foodId : articleId ? "a:" + articleId : "n:" + (nom || "").toLowerCase();
}
