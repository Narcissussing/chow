import { Route, Routes, useLocation } from "react-router-dom";
import Cle from "./components/Cle.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Protege from "./components/Protege.jsx";
import Shell from "./components/Shell.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import Accueil from "./pages/Accueil.jsx";
import AlimentDetail from "./pages/AlimentDetail.jsx";
import Aliments from "./pages/Aliments.jsx";
import CaloriesPage from "./pages/calories/CaloriesPage.jsx";
import CoursesPage from "./pages/courses/CoursesPage.jsx";
import Login from "./pages/Login.jsx";
import StockPage from "./pages/stock/StockPage.jsx";

// Page privée : protégée côté écran (Express protège les données) et recréée à chaque navigation (D6).
const privee = (page) => (
  <Protege>
    <Cle>{page}</Cle>
  </Protege>
);

// D5 : une route par page EJS, aucune route attrape-tout.
export default function App() {
  // Frontière recréée à chaque navigation : une page plantée ne bloque pas les suivantes.
  const { key } = useLocation();
  return (
    <AuthProvider>
      <Shell>
        <ErrorBoundary key={key}>
          <Routes>
            <Route path="/login" element={<Cle><Login /></Cle>} />
            <Route path="/" element={privee(<Accueil />)} />
            <Route path="/aliments" element={privee(<Aliments />)} />
            <Route path="/aliments/:idAliment" element={privee(<AlimentDetail />)} />
            <Route path="/stock" element={privee(<StockPage />)} />
            <Route path="/courses" element={privee(<CoursesPage />)} />
            <Route path="/calories" element={privee(<CaloriesPage />)} />
          </Routes>
        </ErrorBoundary>
      </Shell>
    </AuthProvider>
  );
}
