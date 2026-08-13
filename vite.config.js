import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // IMPORTANT for GitHub Pages: this must match your repo name exactly,
  // e.g. if your repo is github.com/yourname/magents-stokvel, keep this as
  // '/magents-stokvel/'. If you deploy to Netlify/Vercel instead, change
  // this back to '/'.
  base: "/",
});
