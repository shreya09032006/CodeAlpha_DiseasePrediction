import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useTheme } from "./theme";
import Home from "./pages/Home";
import Predict from "./pages/Predict";
import Reports from "./pages/Reports";
import Assistant from "./pages/Assistant";
import Doctors from "./pages/Doctors";
import Ecg from "./pages/Ecg";
import Login from "./pages/Login";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./auth";

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <AuthProvider>
    <div className="app">
      <div className="ambient-glows" aria-hidden="true">
        <div className="ambient-blob-1" />
        <div className="ambient-blob-2" />
      </div>
      <Navbar theme={theme} onToggle={toggle} />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/predict" element={<RequireAuth><Predict /></RequireAuth>} />
          <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
          <Route path="/assistant" element={<RequireAuth><Assistant /></RequireAuth>} />
          <Route path="/ecg" element={<RequireAuth><Ecg /></RequireAuth>} />
          <Route path="/doctors" element={<RequireAuth><Doctors /></RequireAuth>} />
        </Routes>
      </main>
      <footer className="disclaimer">
        For educational purposes only. Not medical advice or a diagnosis. Please consult a doctor for health concerns.
      </footer>
    </div>
    </AuthProvider>
  );
}