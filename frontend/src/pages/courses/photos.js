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

const cle = (idCourse) => "chow-photo-course-" + idCourse;

export function sauvegarderPhotoLocale(idCourse, base64) {
  try {
    localStorage.setItem(cle(idCourse), base64);
  } catch (err) {
    console.warn("Impossible de garder la photo en cache locale :", err);
  }
}

export function lirePhotoLocale(idCourse) {
  try {
    return localStorage.getItem(cle(idCourse));
  } catch {
    return null;
  }
}

export function supprimerPhotoLocale(idCourse) {
  try {
    localStorage.removeItem(cle(idCourse));
  } catch {
  }
}

export function synchroniserPhotosLocales(idsAvecPhoto) {
  idsAvecPhoto.forEach((idCourse) => {
    if (lirePhotoLocale(idCourse)) return;
    fetch(`/api/courses/${idCourse}/photo`, { credentials: "same-origin" })
      .then((reponse) => {
        if (!reponse.ok) throw new Error("photo introuvable");
        return reponse.blob();
      })
      .then((blob) => {
        const lecteur = new FileReader();
        lecteur.onload = () => sauvegarderPhotoLocale(idCourse, lecteur.result.split(",")[1]);
        lecteur.readAsDataURL(blob);
      })
      .catch(() => {
      });
  });
}

export function cleArticlePreset(foodId, nom) {
  return foodId ? "f:" + foodId : "n:" + (nom || "").toLowerCase();
}
