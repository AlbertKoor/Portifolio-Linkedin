import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import LogisticaSmart from "./LogisticaSmart";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LogisticaSmart />
  </StrictMode>,
);
