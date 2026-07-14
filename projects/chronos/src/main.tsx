import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Chronos from "./Chronos";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Chronos />
  </StrictMode>,
);
