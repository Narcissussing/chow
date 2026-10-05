import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Ordre de la cascade : la première importation d'un fichier fixe sa place, quel que soit le composant qui l'importe ensuite.
import "./styles/base.css";
import "./components/Header.css";
import "./pages/accueil/Accueil.css";
import "./pages/courses/CoursesPage.css";
import "./pages/stock/StockPage.css";
import "./pages/aliments/Aliments.css";
import "./pages/aliments/AlimentDetail.css";
import "./pages/courses/PanneauAjout.css";
import "./pages/courses/CourseItem.css";
import "./components/Toast.css";
import "./components/BoutonEffacer.css";
import "./pages/login/Login.css";
import "./pages/stock/StockItem.css";
import "./components/Footer.css";
import "./pages/calories/cuisine/CuisineItem.css";
import "./pages/calories/recettes/Recettes.css";
import "./styles/communs.css";
import "./pages/calories/cuisine/Cuisine.css";
import "./pages/calories/recettes/RecetteSheet.css";
import "./pages/calories/recettes/IngredientLigne.css";
import "./pages/calories/CaloriesPage.css";
import "./components/CustomSelect.css";
import "./pages/courses/PhotoApercu.css";
import "./components/Chargement.css";
import "./components/Triable.css";
import "./pages/courses/BoutonMagasin.css";
import "./pages/calories/reglex/AdapterRecette.css";
import "./components/BoutonOutil.css";
import "./components/BadgeCompteur.css";
import "./pages/calories/cuisine/CuisineVide.css";
import "./pages/stock/StockSuggestions.css";
import "./pages/courses/CoursesVide.css";
import "./styles/fin.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
