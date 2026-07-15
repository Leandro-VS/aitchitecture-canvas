import { Route, Routes } from "react-router-dom";

import { Home } from "../pages/Home";
import { NewDiagram } from "../pages/NewDiagram";
import { Session } from "../pages/Session";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/diagrams/new" element={<NewDiagram />} />
      <Route path="/session/:id" element={<Session />} />
    </Routes>
  );
}
