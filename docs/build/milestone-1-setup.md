# Milestone 1 setup: deploy the internal testing app

Plain-English steps to put the app online: Supabase (database and login) plus Vercel (the website). Allow about 45
minutes. You need accounts on [supabase.com](https://supabase.com), [vercel.com](https://vercel.com) and GitHub
(owner access to `javoniehodge-code/aibizscanner`).

**Milestone 1 is only complete when you have deployed it and checked every item in the
[verification checklist](#verification-checklist) in your own browser.**

Keep a private note open as you go. You will collect a few values (marked 📋) that later steps need. Never paste
them into GitHub issues, pull requests or code.

---

## 1. Merge the six pull requests

The Milestone 1 pull requests are stacked: each one builds on the previous one. Merge them **in order, 1 to 6**,
and only when GitHub shows all checks green. After merging each one, click **Delete branch**. GitHub then
automatically points the next pull request at `main`.

You can do steps 2 to 4 before or while you merge.

## 2. Create the Supabase project

1. In Supabase, click **New project**.
   - **Name:** `aibizscanner-internal`, or any name you like.
   - **Database password:** click **Generate a password**. 📋 Save it as **DB password**.
   - **Region:** the one closest to you, e.g. *East US*.
2. Wait for the project to finish setting up (1–2 minutes).
3. Collect these values:
   - 📋 **Project ref:** **Project Settings → General → Project ID** (20 lowercase letters). It is also the part of
     the project URL after `/project/`.
   - 📋 **Project URL:** **Project Settings → Data API → Project URL** (`https://<project-ref>.supabase.co`).
   - 📋 **Publishable key:** **Project Settings → API Keys** → the **publishable** key (`sb_publishable_…`). If your
     project only shows legacy keys, the `anon` key works too.
   - 📋 **Secret key:** same page → **Secret keys** → create or reveal one (`sb_secret_…`). If your project only shows
     legacy keys, the `service_role` key works. This key bypasses all access rules, so keep it secret.

## 3. Turn off sign-ups and create your admin login

1. **Authentication → Sign In / Providers**:
   - Make sure **Email** is enabled.
   - Turn **off** **Allow new users to sign up**, then **Save**.

   No one can create an account from now on. The app has no sign-up page either.
2. **Authentication → Users → Add user → Create new user**:
   - Enter your email and a strong password.
   - Tick **Auto Confirm User**, then click **Create user**.
3. Click the new user and copy its **UID**. 📋 Save it as **Admin user id**.

You will make this user an admin in step 6, after the database tables exist.

## 4. Let GitHub apply database changes

The workflow **Apply database migrations (hosted Supabase)** updates your database every time a change to
`supabase/migrations` lands on `main`. It needs three repository secrets.

1. Create a Supabase access token at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
   (**Generate new token**, name it `github-actions`). 📋 Copy it once; it isn't shown again.
2. In GitHub, open the repository → **Settings → Secrets and variables → Actions → New repository secret**, and add:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_ACCESS_TOKEN` | the access token from step 4.1 |
   | `SUPABASE_DB_PASSWORD` | 📋 DB password |
   | `SUPABASE_PROJECT_REF` | 📋 Project ref |

## 5. Apply the database

After pull request 6 is merged:

1. Open **Actions → Apply database migrations (hosted Supabase)**.
2. If it didn't already run on the last merge (or it ran before the secrets existed), click **Run workflow → main**.
3. Wait for a green check. In Supabase, **Table Editor** should now list tables such as `business`, `report`,
   `stage_run` and `report_document`.

If the job says *"Migrations not applied: missing repository secrets"*, recheck step 4. The names must match exactly.

## 6. Make yourself an admin

In Supabase, open **SQL Editor → New query**, paste the following with your 📋 Admin user id in place of the
placeholder, and click **Run**:

```sql
insert into public.admin_user (user_id, note) values ('PASTE-ADMIN-USER-ID-HERE', 'owner');
```

Only users in this table can see anything in the app. Anyone else who manages to sign in gets a "No access" page.

## 7. Create the Vercel project

1. In Vercel, click **Add New… → Project**, then **Import** `javoniehodge-code/aibizscanner`. If it isn't listed, use
   **Adjust GitHub App Permissions** to give Vercel access to it.
2. On the configure screen:
   - **Root Directory:** click **Edit** and choose `web`.
   - **Framework Preset:** Next.js (detected automatically). Leave the build and output settings as they are.
   - Under **Root Directory**, keep **Include files outside the root directory in the Build Step** turned **on** (the
     default). The app copies the report design from `design/reports` and the example data from `fixtures` while it
     builds.
3. Open **Environment Variables** and add these four. They apply to all environments.

   | Name | Value | Where it comes from |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | 📋 Project URL | Supabase → Project Settings → Data API |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 📋 Publishable key | Supabase → Project Settings → API Keys |
   | `SUPABASE_SECRET_KEY` | 📋 Secret key | Supabase → Project Settings → API Keys (secret) |
   | `CRON_SECRET` | a new random value of at least 32 characters | You make it up. On a Mac or Linux terminal, run `openssl rand -hex 32`, or use a password manager's generator (letters and digits only). 📋 Save it as **Cron secret**. |

4. Click **Deploy**. When it finishes, 📋 save the production address, e.g. `https://aibizscanner-internal.vercel.app`,
   as **App URL**.
5. Back in Supabase, open **Authentication → URL Configuration**, set **Site URL** to your 📋 App URL, and click
   **Save**.

You don't need to set `VERCEL_GIT_COMMIT_SHA`: Vercel provides it, and `/health` shows it.

## 8. Turn on the background worker (every minute)

Report stages run in a background worker. Supabase calls the app's worker address once a minute, at no extra cost.
It needs to know the address and the shared secret. Both are stored in Supabase Vault (encrypted), never in code.

In **SQL Editor → New query**, replace both placeholders and click **Run**:

```sql
select vault.create_secret('PASTE-APP-URL-HERE/api/worker/tick', 'worker_tick_url');
select vault.create_secret('PASTE-CRON-SECRET-HERE', 'worker_cron_secret');
```

- The first value is your 📋 App URL followed by `/api/worker/tick`, with no trailing slash before `/api`. For example:
  `https://aibizscanner-internal.vercel.app/api/worker/tick`
- The second value must be exactly the same as `CRON_SECRET` in Vercel.

To change one later, for example after rotating the cron secret:

```sql
select vault.update_secret(id, 'NEW-VALUE') from vault.secrets where name = 'worker_cron_secret';
```

If you rotate `CRON_SECRET`, change it in both places and redeploy on Vercel (**Deployments → … → Redeploy**).

**Check that the worker is being called.** After a minute or two, run:

```sql
select status_code, content::text, created from net._http_response order by created desc limit 5;
```

You want `200` responses whose content starts with `{"recoveredExpiredLeases"`.

| What you see | Meaning |
| --- | --- |
| `401` | The two secrets don't match. |
| `503` | `CRON_SECRET` or `SUPABASE_SECRET_KEY` is missing in Vercel. |
| No rows at all | The Vault secrets aren't set yet, or the URL is wrong. |

Production deployments on Vercel are reachable by default. If you turned on Vercel deployment protection for
production, the worker calls will be blocked.

---

## Verification checklist

Do these in your browser, on the production App URL.

- [ ] **Login is the only public page.**
  - Open `APP-URL/health` in a private window. You are sent to the sign-in page.
  - There is no sign-up link.
- [ ] **You can sign in.** Sign in with your admin email and password. You land on the app's home page and see
  *Businesses*, *Reports* and *Health* at the top.
- [ ] **`/health` shows the database is connected.** Open **Health**. It should show:
  - **Database: Connected**
  - a database time
  - the latest migration, `20261112000400`
  - a **Git commit** that matches the latest commit on `main`
- [ ] **Both example reports render.**
  - Open **Reports → Load example reports**. *Brownstone Movers* and *MVP Miami* appear in the list.
  - Click **View report** for Brownstone Movers. The full report design appears with "Brownstone Movers · Brooklyn,
    NY" in the corner. Step through all slides with the arrow keys or the bar at the top.
  - Do the same for MVP Miami. Where its older export didn't record something, the slide says *Not recorded for this
    report* or *Not available for this report* instead of showing numbers.
- [ ] **The dummy stage runs through the worker and shows its cost.**
  - Open **Businesses → Add business** and add any test business.
  - Go to **Reports**, pick that business under *New test report for* and click **Create report**.
  - On the run monitor, click **Run** next to *Dummy: fake priced call*. It shows *queued*.
  - Wait up to a minute without clicking anything (the scheduled worker picks it up), then reload the page. It shows
    **done**, with **$0.0118** cost and **1,200 / 300** tokens.

    If it stays queued after two minutes, the schedule isn't reaching the app: see step 8. **Process queue now** runs
    the same worker on demand.
  - Click **Rerun this stage**, then wait and reload. Version **v2** is done, v1 is still listed under *All runs*,
    and the total reads **$0.0236**.
- [ ] **Someone who isn't an admin gets no access.** Optional: create a second user in Supabase (step 3.2) without
  adding them to `admin_user`, and sign in as them. They see **No access**.

When every box is ticked, Milestone 1 is done. Reply on the last pull request to confirm, or say which item failed
and what you saw.

## If something goes wrong

| Symptom | Likely cause |
| --- | --- |
| The Vercel build fails with "Missing or invalid environment variables" | A variable name in step 7.3 is misspelled. Fix it, then **Redeploy**. |
| The Vercel build fails because it can't find `design/reports` or `fixtures` | *Include files outside the root directory* is off (step 7.2). Turn it on under **Project Settings → Build and Deployment → Root Directory**. |
| You're sent back to the sign-in page after signing in | The Vercel environment variables point at a different Supabase project, or the password is wrong. |
| "No access" for your own login | Step 6 wasn't run, or used a different user id. Check **Table Editor → admin_user**. |
| `/health` shows "Not connected" | The tables don't exist yet (step 5), or the publishable key is wrong. |
