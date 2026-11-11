import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
<<<<<<< HEAD
  // Default is "/" — correct for Netlify, Vercel, or any host that serves
  // your site from the root URL (yoursite.netlify.app, yoursite.vercel.app).
  //
  // ONLY if you deploy to GitHub Pages instead (where the site lives at
  // yourname.github.io/REPO-NAME/), change this to match your repo name,
  // e.g. base: "/magents-stokvel/" — then run npm run build again before
  // npm run deploy. If you switch back to Netlify/Vercel afterwards,
  // change it back to "/".
=======
  // IMPORTANT for GitHub Pages: this must match your repo name exactly,
  // e.g. if your repo is github.com/yourname/magents-stokvel, keep this as
  // '/magents-stokvel/'. If you deploy to Netlify/Vercel instead, change
  // this back to '/'.
>>>>>>> 6e2a3a52b00bf86ec885ba360374648add38dfb7
  base: "/",
});
