# Bryce Performance Lab – coaching app

One web app for the coach and the athletes:

- **Coach** (`/coach`): add athletes by email with their test zones, plan sessions on a 4-week calendar (templates, tags, settings, reps and recoveries), see each run's detected workout, rep verdicts and pace chart, compare against the last 6 similar sessions, and reply to the athlete.
- **Athlete** (`/athlete`): this week, month calendar, session details with target paces, log a run (.FIT or Garmin .zip, split files joined), RPE, lactate and a note, results, progress and zones. Works on phone and computer.
- **Logins**: email + password. Only the coach email (`rileymacbryce@gmail.com`) and athletes the coach has added can create accounts; athletes are linked to the coach automatically.

Built with Next.js (hosting on Vercel) and Supabase (database, logins, file storage). Everything below uses free plans.

---

## Going live (about 20 minutes)

### 1. Supabase (database and logins)
1. Sign up at **supabase.com** (free plan) and create a project. Pick the **Sydney** region and save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste everything from `supabase/migrations/20261022000000_init.sql`, and click **Run**.
3. **Authentication → Sign In / Providers → Email**: turn **off** “Confirm email”, then save. (Supabase's built-in email only reaches your own address, so confirmation emails wouldn't reach athletes. Sign-up is still limited to emails you've added.)
4. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key**. You need them in step 3.

### 2. GitHub (stores the code)
1. Sign up at **github.com** (free) and create a new **private** repository called `bpl-app`.
2. Upload this folder's contents (drag and drop on the repository page, or use GitHub Desktop). Don't upload `node_modules`, `.next`, or `.env.local` if they're there.

### 3. Vercel (puts it on the internet)
1. Sign up at **vercel.com** with your GitHub account (Hobby plan, free).
2. **Add New → Project**, import `bpl-app`.
3. Under **Environment Variables** add:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon / publishable key
4. Click **Deploy**. You get an address like `bpl-app.vercel.app`.
5. Back in Supabase: **Authentication → URL Configuration**, set **Site URL** to that address.

### 4. First use
1. Open the site, choose **Create your account**, and sign up with `rileymacbryce@gmail.com`. That account is the coach.
2. **+ Add athlete** with their name, email and test paces.
3. Send the athlete the site address. They choose **Create your account** with the same email and are linked to you.

> Vercel's free Hobby plan is for non-commercial use. It's fine while you build and test. Move to Pro (about US$20/month) when athletes are paying for coaching.

---

## Garmin import (your own runs only)
Garmin's Personal API key is for the key owner's own data, so it's switched on for one athlete record.
In Vercel → Settings → Environment Variables add (server-only, no NEXT_PUBLIC_ prefix):
- `GARMIN_PERSONAL_API_KEY` = your personal key from Garmin Connect (mark it Sensitive)
- `GARMIN_ATHLETE_EMAIL` = the email on *your* athlete record in the app
Then redeploy. On that athlete's runs the coach sees **Import from Garmin Connect**.
For athletes, apply for Garmin's Starter (business) tier instead.

## Not set up yet
- **Forgot-password emails** need an email service (e.g. Resend) connected in Supabase → Authentication → SMTP. Until then, reset a password from Supabase → Authentication → Users.
- **Automatic watch sync** (Terra etc.), payments and notifications.
- **Adding more coaches**: change `coach_email` in the `app_config` table (the database already supports multiple coaches).

## Running on your computer (optional)
Needs Node.js 20 or later.
```
npm install
cp .env.example .env.local     # then fill in the two Supabase values
npm run dev                    # opens on http://localhost:3000
npm test                       # checks the .FIT analysis against sample files
```

## Where things are
- `lib/engine.js`: .FIT reading, joining split files, workout detection, verdicts, comparisons
- `supabase/migrations/…_init.sql`: tables, sign-up rules, security rules (athletes only see their own data), file storage
- `app/coach/…`, `app/athlete/…`: the pages
- `components/…`: shared pieces (run logger, analysis view, compare, session editor)
- `tests/`: analysis tests and a security check (`tests/security.local.mjs`, run against a local Supabase)
