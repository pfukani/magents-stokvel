# Magents Stokvel — setup & deployment guide

This is a standalone version of the stokvel dashboard: React app + Supabase
<<<<<<< HEAD
(free database) for shared data, deployable to a free public URL. Members
sign in with a one-time email link — no password, no PIN — and the
database itself only ever hands data to people you've explicitly added.

---

## If you already have this deployed (upgrading from the PIN version)

You had the app live with the old PIN system. This version replaces that
entirely with real per-person sign-in, so there are two things to update
in your **existing** Supabase project before you redeploy the new code:

1. Open your Supabase project → **SQL Editor**, and run:

   ```sql
   -- Remove the old "anyone can read/write" rules
   drop policy if exists "Allow public read" on kv_store;
   drop policy if exists "Allow public write" on kv_store;
   drop policy if exists "Allow public update" on kv_store;

   -- Table of who's allowed to sign in, and their role
   create table allowed_users (
     email text primary key,
     role text not null default 'member' check (role in ('admin','member')),
     created_at timestamptz default now()
   );
   alter table allowed_users enable row level security;

   create policy "signed-in members can read the access list" on allowed_users
     for select using (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email')
     );
   create policy "admins can add to the access list" on allowed_users
     for insert with check (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.role = 'admin')
     );
   create policy "admins can edit the access list" on allowed_users
     for update using (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.role = 'admin')
     );
   create policy "admins can remove from the access list" on allowed_users
     for delete using (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.role = 'admin')
     );

   -- New rules for the data table: only people on the access list
   create policy "signed-in members can read club data" on kv_store
     for select using (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email')
     );
   create policy "admins can write club data" on kv_store
     for insert with check (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.role = 'admin')
     );
   create policy "admins can update club data" on kv_store
     for update using (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.role = 'admin')
     );

   -- Add yourself as the first admin (edit the email below)
   insert into allowed_users (email, role) values ('you@example.com', 'admin');
   ```

2. Follow "Configure email sign-in" below, then rebuild and redeploy
   (`npm run build`, push to GitHub as usual). Your existing members,
   contributions, and interest data are untouched — only *who can log in*
   changes.

If this is a fresh setup instead, skip this section and start at Step 1.
=======
(free database) for shared data, deployable to a free public URL.

You'll do three things: (1) create a free database, (2) run the app on your
own computer once to check it works, (3) put it on GitHub and host it for
free. None of this needs coding experience — just follow the steps in order.
>>>>>>> 6e2a3a52b00bf86ec885ba360374648add38dfb7

---

## 1. Create your free database (Supabase)

1. Go to https://supabase.com and sign up (free plan is enough).
2. Click **New project**. Pick any name (e.g. `magents-stokvel`) and a
   password (you won't need to remember this password day-to-day, but save
   it somewhere).
<<<<<<< HEAD
3. Once the project finishes setting up, open the **SQL Editor** and run
   this, exactly as written:
=======
3. Once the project finishes setting up, open the **SQL Editor** (left
   sidebar) and run this, exactly as written:
>>>>>>> 6e2a3a52b00bf86ec885ba360374648add38dfb7

   ```sql
   create table kv_store (
     key text primary key,
     value jsonb not null,
     updated_at timestamptz default now()
   );
<<<<<<< HEAD
   alter table kv_store enable row level security;

   create table allowed_users (
     email text primary key,
     role text not null default 'member' check (role in ('admin','member')),
     created_at timestamptz default now()
   );
   alter table allowed_users enable row level security;

   create policy "signed-in members can read the access list" on allowed_users
     for select using (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email')
     );
   create policy "admins can add to the access list" on allowed_users
     for insert with check (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.role = 'admin')
     );
   create policy "admins can edit the access list" on allowed_users
     for update using (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.role = 'admin')
     );
   create policy "admins can remove from the access list" on allowed_users
     for delete using (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.role = 'admin')
     );

   create policy "signed-in members can read club data" on kv_store
     for select using (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email')
     );
   create policy "admins can write club data" on kv_store
     for insert with check (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.role = 'admin')
     );
   create policy "admins can update club data" on kv_store
     for update using (
       exists (select 1 from allowed_users au where au.email = auth.jwt()->>'email' and au.role = 'admin')
     );

   -- Add yourself as the first admin (edit the email below to your own)
   insert into allowed_users (email, role) values ('you@example.com', 'admin');
   ```

   `kv_store` holds your stokvel data (members, contributions, interest).
   `allowed_users` holds who's allowed to sign in and whether they're an
   admin or a view-only member — you manage this list later from inside
   the app's Settings tab, but the very first admin has to be added here
   directly, since nobody can grant admin rights before an admin exists.

4. Go to **Project Settings → API**. You'll need two values in Step 3:
   - **Project URL**
   - **anon public** key

   > These are meant to be public — safe to put in a public GitHub repo.
   > The `anon` key only works within the rules you just created above; it
   > can't read or write anything outside what those policies allow, and
   > it's not your database password.

---

## 2. Configure email sign-in

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your live site's address (e.g.
   `https://magents-stokvel.netlify.app`). If you don't have a live URL
   yet, use `http://localhost:5173` for now and update this once you
   deploy.
3. Under **Redirect URLs**, add both `http://localhost:5173` (for testing
   on your computer) and your live site's URL. This is what lets the
   sign-in email link actually bring people back to the right place.
4. Email sign-in is on by default on Supabase's free plan — no extra setup
   needed. (Free-plan email sending has a modest daily limit, which is
   fine for a stokvel's worth of members; if you outgrow it later,
   Supabase lets you connect your own email sender.)

---

## 3. Run it on your computer once (to confirm it works)
=======

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
>>>>>>> 6e2a3a52b00bf86ec885ba360374648add38dfb7

You'll need [Node.js](https://nodejs.org) installed (any recent version).

1. Unzip this project and open a terminal in the `magents-stokvel` folder.
2. Copy `.env.example` to a new file named `.env`, and paste in your
<<<<<<< HEAD
   Project URL and anon key from Step 1.4.
=======
   Project URL and anon key from step 1.4.
>>>>>>> 6e2a3a52b00bf86ec885ba360374648add38dfb7
3. Run:
   ```
   npm install
   npm run dev
   ```
<<<<<<< HEAD
4. Open the link it prints (usually `http://localhost:5173`). Sign in
   with the email you added as the first admin — you'll get a magic link
   by email. Once in, add a test member under Members, and add a couple
   more emails under Settings → Manage access to confirm it all saves.
=======
4. Open the link it prints (usually `http://localhost:5173`). You should
   see the dashboard, empty and ready for members. Add a test member to
   confirm it saves — refresh the page and it should still be there.
>>>>>>> 6e2a3a52b00bf86ec885ba360374648add38dfb7

If that works, you're ready to publish it.

---

<<<<<<< HEAD
## 4. Put it on GitHub and host it for free
=======
## 3. Put it on GitHub and host it for free
>>>>>>> 6e2a3a52b00bf86ec885ba360374648add38dfb7

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

<<<<<<< HEAD
### Option A — Netlify or Vercel (recommended, works with defaults)

Both let you connect your GitHub repo and deploy automatically on every
push, and handle environment variables for you in their dashboard (so your
keys aren't in the built files at all, only fetched at build time). The
project's default settings (`base: "/"` in `vite.config.js`) are already
correct for these — no editing needed.
=======
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
>>>>>>> 6e2a3a52b00bf86ec885ba360374648add38dfb7

1. Sign up at https://netlify.com or https://vercel.com with your GitHub
   account.
2. "Import" your `magents-stokvel` repo.
3. Set the build command to `npm run build` and output directory to `dist`.
4. Add two environment variables in their dashboard: `VITE_SUPABASE_URL`
   and `VITE_SUPABASE_ANON_KEY` (same values as your `.env`).
5. Deploy. You'll get a free `.netlify.app` or `.vercel.app` link to share.
<<<<<<< HEAD
6. Go back to Supabase → Authentication → URL Configuration and update
   the Site URL and Redirect URLs to this live address (see Step 2) —
   sign-in links won't work correctly until you do.

### Option B — GitHub Pages (stays entirely on GitHub)

GitHub Pages serves your site from a *subfolder* of your username's domain
(`yourname.github.io/magents-stokvel/`), not the root — so it needs one
extra edit that Netlify/Vercel don't:

1. Open `vite.config.js` and change `base: "/"` to match your repo name,
   e.g. `base: "/magents-stokvel/"`.
2. Since GitHub Pages has no way to keep a `.env` file secret at build
   time, and the Supabase anon key is safe to expose (see note above),
   bake it into the build instead:
   ```
   npm run build
   npm run deploy
   ```
3. In your GitHub repo, go to **Settings → Pages**, and under "Build and
   deployment" set the source branch to `gh-pages`.
4. Your site will be live at:
   `https://YOUR-USERNAME.github.io/magents-stokvel/` — update Supabase's
   Site URL and Redirect URLs to match (Step 2).

If you ever switch back to Netlify/Vercel afterwards, change `base` back
to `"/"` and redeploy.
=======

Either option works — GitHub Pages keeps everything in one place, Netlify/
Vercel is a little more forgiving if you rename the repo later.
>>>>>>> 6e2a3a52b00bf86ec885ba360374648add38dfb7

---

## Sharing it with your team

<<<<<<< HEAD
Add each member's email under Settings → Manage access (as a "Member" for
view-only, or "Admin" if they should be able to edit), then send them the
live URL. When they open it, they enter their email and get a sign-in
link — no password, no PIN to share around. Only people you've explicitly
added will ever get past the sign-in screen.

## A note on security

This replaces the old PIN entirely with real per-person access control,
enforced by the database itself (via the Row Level Security policies
above) — not just by the app's front-end. Someone without a registered
email genuinely cannot read your data, even if they have the site's URL.

The one thing still worth keeping in mind: anyone you add as "Admin" has
full edit rights, same as you. Only promote people to admin who you'd
trust with a pen-and-paper ledger.
=======
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
>>>>>>> 6e2a3a52b00bf86ec885ba360374648add38dfb7
