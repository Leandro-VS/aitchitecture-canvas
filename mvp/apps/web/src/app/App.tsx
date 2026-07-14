import { Route, Routes } from "react-router-dom";

import { Home } from "../pages/Home";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* Fase 1: /diagrams/new (wizard de intake) e /session/:id (playground) */}
    </Routes>
  );
}
