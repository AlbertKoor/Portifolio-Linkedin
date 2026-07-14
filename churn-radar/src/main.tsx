import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import ChurnRadar from "./ChurnRadar";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChurnRadar />
  </StrictMode>,
);
