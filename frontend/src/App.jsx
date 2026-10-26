import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import Cle from "./components/Cle.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Protege from "./components/Protege.jsx";
import Shell from "./components/Shell.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { usePlaceholdersDefilants } from "./hooks/usePlaceholdersDefilants.js";
import Accueil from "./pages/accueil/Accueil.jsx";
import AlimentDetail from "./pages/aliments/AlimentDetail.jsx";
import Aliments from "./pages/aliments/Aliments.jsx";
import CaloriesPage from "./pages/calories/CaloriesPage.jsx";
import CoursesPage from "./pages/courses/CoursesPage.jsx";
import Login from "./pages/login/Login.jsx";
import Parametres from "./pages/parametres/Parametres.jsx";
import StatsPage from "./pages/stats/StatsPage.jsx";
import StockPage from "./pages/stock/StockPage.jsx";

const privee = (page, admin = false) => (
  <Protege admin={admin}>
    <Cle>{page}</Cle>
  </Protege>
);

function AncienAliment() {
  const { idAliment } = useParams();
  return <Navigate to={"/parametres/aliments/" + encodeURIComponent(idAliment)} replace />;
}

export default function App() {
  usePlaceholdersDefilants();
  const { key } = useLocation();
  return (
    <AuthProvider>
      <Shell>
        <ErrorBoundary key={key}>
          <Routes>
            <Route path="/login" element={<Cle><Login /></Cle>} />
            <Route path="/" element={privee(<Accueil />)} />
            <Route path="/parametres" element={privee(<Parametres />, true)} />
            <Route path="/parametres/aliments" element={privee(<Aliments />, true)} />
            <Route path="/parametres/aliments/:idAliment" element={privee(<AlimentDetail />, true)} />
            <Route path="/aliments" element={<Navigate to="/parametres/aliments" replace />} />
            <Route path="/aliments/:idAliment" element={<AncienAliment />} />
            <Route path="/stats" element={privee(<StatsPage />)} />
            <Route path="/stock" element={privee(<StockPage />)} />
            <Route path="/courses" element={privee(<CoursesPage />)} />
            <Route path="/calories" element={privee(<CaloriesPage />)} />
          </Routes>
        </ErrorBoundary>
      </Shell>
    </AuthProvider>
  );
}
