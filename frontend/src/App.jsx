import { Route, Routes, useLocation } from "react-router-dom";
import Cle from "./components/Cle.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Protege from "./components/Protege.jsx";
import Shell from "./components/Shell.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import Accueil from "./pages/accueil/Accueil.jsx";
import AlimentDetail from "./pages/aliments/AlimentDetail.jsx";
import Aliments from "./pages/aliments/Aliments.jsx";
import CaloriesPage from "./pages/calories/CaloriesPage.jsx";
import CoursesPage from "./pages/courses/CoursesPage.jsx";
import Login from "./pages/login/Login.jsx";
import StockPage from "./pages/stock/StockPage.jsx";

const privee = (page) => (
  <Protege>
    <Cle>{page}</Cle>
  </Protege>
);

export default function App() {
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
