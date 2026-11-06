import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useTheme } from "./theme";
import Home from "./pages/Home";
import Predict from "./pages/Predict";
import Reports from "./pages/Reports";
import Assistant from "./pages/Assistant";
import Doctors from "./pages/Doctors";

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <div className="app">
      <div className="ambient-glows" aria-hidden="true">
        <div className="ambient-blob-1" />
        <div className="ambient-blob-2" />
      </div>
      <Navbar theme={theme} onToggle={toggle} />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/predict" element={<Predict />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/doctors" element={<Doctors />} />
        </Routes>
      </main>
      <footer className="disclaimer">
        For educational purposes only. Not medical advice or a diagnosis. Please consult a doctor for health concerns.
      </footer>
    </div>
  );
}