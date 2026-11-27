import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
export default {
  content: [path.join(root, "index.html"), path.join(root, "src/**/*.{ts,tsx}")],
  theme: { extend: { fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] } } },
  plugins: [],
};
