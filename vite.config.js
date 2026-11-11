import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Default is "/" — correct for Netlify, Vercel, or any host that serves
  // your site from the root URL (yoursite.netlify.app, yoursite.vercel.app).
  //
  // ONLY if you deploy to GitHub Pages instead (where the site lives at
  // yourname.github.io/REPO-NAME/), change this to match your repo name,
  // e.g. base: "/magents-stokvel/" — then run npm run build again before
  // npm run deploy. If you switch back to Netlify/Vercel afterwards,
  // change it back to "/".
  base: "/",
});
