# Magents Stokvel — setup & deployment guide

This is a standalone version of the stokvel dashboard: React app + Supabase
(free database) for shared data, deployable to a free public URL.

You'll do three things: (1) create a free database, (2) run the app on your
own computer once to check it works, (3) put it on GitHub and host it for
free. None of this needs coding experience — just follow the steps in order.

---

## 1. Create your free database (Supabase)

1. Go to https://supabase.com and sign up (free plan is enough).
2. Click **New project**. Pick any name (e.g. `magents-stokvel`) and a
   password (you won't need to remember this password day-to-day, but save
   it somewhere).
3. Once the project finishes setting up, open the **SQL Editor** (left
   sidebar) and run this, exactly as written:

   ```sql
   create table kv_store (
     key text primary key,
     value jsonb not null,
     updated_at timestamptz default now()
   );

   alter table kv_store enable row level security;

   create policy "Allow public read" on kv_store
     for select using (true);

   create policy "Allow public write" on kv_store
     for insert with check (true);

   create policy "Allow public update" on kv_store
     for update using (true);
   ```

   This creates one simple table the app uses to store all your stokvel
   data (members, contributions, interest, penalties).

4. Go to **Project Settings → API**. You'll need two values from this page
   in step 2 below:
   - **Project URL**
   - **anon public** key

   > These are meant to be public — they're safe to put in a public GitHub
   > repo. The `anon` key only works within the rules you just created
   > above (open read/write to this one table). It is **not** your database
   > password, and it can't be used to access anything else in your
   > Supabase account.

---

## 2. Run it on your computer once (to confirm it works)

You'll need [Node.js](https://nodejs.org) installed (any recent version).

1. Unzip this project and open a terminal in the `magents-stokvel` folder.
2. Copy `.env.example` to a new file named `.env`, and paste in your
   Project URL and anon key from step 1.4.
3. Run:
   ```
   npm install
   npm run dev
   ```
4. Open the link it prints (usually `http://localhost:5173`). You should
   see the dashboard, empty and ready for members. Add a test member to
   confirm it saves — refresh the page and it should still be there.

If that works, you're ready to publish it.

---

## 3. Put it on GitHub and host it for free

### Push the code to GitHub

1. Go to https://github.com and create a new **empty** repository named
   `magents-stokvel` (any name is fine — just remember it).
2. In your terminal, inside the project folder:
   ```
   git init
   git add .
   git commit -m "Magents Stokvel dashboard"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/magents-stokvel.git
   git push -u origin main
   ```
   (`.env` is excluded automatically — your Supabase keys won't be pushed
   as a raw file, though see the note on `VITE_` variables below.)

### Option A — GitHub Pages (free, stays on GitHub)

1. If your repo name isn't `magents-stokvel`, open `vite.config.js` and
   change `base: "/magents-stokvel/"` to match your actual repo name.
2. Since GitHub Pages has no way to keep a `.env` file secret at build
   time, and the Supabase anon key is safe to expose (see note above),
   bake it into the build instead:
   ```
   npm run build
   npm run deploy
   ```
   `npm run deploy` publishes the `dist` folder to a `gh-pages` branch.
3. In your GitHub repo, go to **Settings → Pages**, and under "Build and
   deployment" set the source branch to `gh-pages`.
4. Your site will be live at:
   `https://YOUR-USERNAME.github.io/magents-stokvel/`

### Option B — Netlify or Vercel (also free, slightly less setup)

Both let you connect your GitHub repo and deploy automatically on every
push, and handle environment variables for you in their dashboard (so your
keys aren't in the built files at all, only fetched at build time):

1. Sign up at https://netlify.com or https://vercel.com with your GitHub
   account.
2. "Import" your `magents-stokvel` repo.
3. Set the build command to `npm run build` and output directory to `dist`.
4. Add two environment variables in their dashboard: `VITE_SUPABASE_URL`
   and `VITE_SUPABASE_ANON_KEY` (same values as your `.env`).
5. Deploy. You'll get a free `.netlify.app` or `.vercel.app` link to share.

Either option works — GitHub Pages keeps everything in one place, Netlify/
Vercel is a little more forgiving if you rename the repo later.

---

## Sharing it with your team

Send them the live URL. Everyone opens it in "view only" mode; anyone with
the admin PIN (default `1234` — **change this immediately** under Settings
once you're live) can add members and edit contributions. Data updates for
everyone in real time since it's all reading from the same database.

## A note on security

The admin PIN is a light gate to stop casual edits — it lives in the app's
own data, not a real login system. The Supabase policies above allow
anyone with your site's URL to read and write the data (same trust model
as the PIN). This is fine for a small, trusted stokvel group sharing a
link privately. If your group grows or you want real per-member logins
later, Supabase supports proper authentication — worth revisiting at that
point.
