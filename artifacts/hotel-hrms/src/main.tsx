import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

setAuthTokenGetter(() => localStorage.getItem("token"));
const apiUrl = import.meta.env.VITE_API_URL;
const baseUrl = apiUrl && !apiUrl.includes("railway.app") ? apiUrl : null;
setBaseUrl(baseUrl);

createRoot(document.getElementById("root")!).render(<App />);
