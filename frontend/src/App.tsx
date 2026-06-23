import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Report from "./pages/Report";
import Analytics from "./pages/Analytics";
import Company from "./pages/Company";
import Person from "./pages/Person";
import BossBattle from "./pages/BossBattle";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Dashboard />} />
      <Route path="/report" element={<Report />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/company/:eik" element={<Company />} />
      <Route path="/person/:hash" element={<Person />} />
      <Route path="/boss-battle" element={<BossBattle />} />
    </Routes>
  );
}
