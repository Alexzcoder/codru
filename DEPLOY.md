# Deploying Codru to Vercel

Vercel Free tier + Neon Free tier. Both in Frankfurt (fra1).

## One-time setup

### 1. Put the code on GitHub

You already have a remote (`Alexzcoder/birthday-app`). Either:

- **Reuse it** (just push; the repo name doesn't affect Vercel). Cheapest path.
- **Create a new repo** at https://github.com/new (e.g. "codru"), then:
  ```bash
  git remote set-url origin https://github.com/<you>/codru.git
  ```

Then push:
```bash
git push -u origin main
```

### 2. Import to Vercel

1. https://vercel.com/signup → sign in with GitHub.
2. **Add New → Project** → pick your repo.
3. Framework: **Next.js** (auto-detected).
4. Root directory: leave as `/`.
5. Build/install commands: leave as defaults; `package.json` already runs `prisma generate` before `next build`.
6. **Environment Variables** — paste these (grab values from `.env.local`, but see notes):

    | Key | Value |
    |---|---|
    | `DATABASE_URL` | same as local (Neon **pooler** URL) |
    | `DIRECT_URL` | same as local (Neon **direct** URL) |
    | `AUTH_SECRET` | **generate a new one**: `openssl rand -base64 32` |
    | `AUTH_URL` | `https://<your-app>.vercel.app` (set after first deploy) |
    | `APP_URL` | same as `AUTH_URL` |
    | `RESEND_API_KEY` | from resend.com dashboard (optional; leave blank for dev-mode) |
    | `RESEND_FROM` | `Codru <onboarding@resend.dev>` until you verify a domain |

    **Do NOT set `DEV_BYPASS` in production** — that would disable authentication.

7. **Region**: already pinned to `fra1` via `vercel.json`. Verify in Project → Settings → Functions.
8. **Deploy**.

### 3. After first deploy

- Note the URL Vercel gave you (e.g. `https://codru-abc123.vercel.app`).
- Go back to Project → Settings → Environment Variables. Set `AUTH_URL` and `APP_URL` to that URL. Redeploy (Vercel → Deployments → latest → Redeploy).
- Visit the URL. You'll land on `/register` (because `DEV_BYPASS` is off in prod). Create your owner account fresh, or sign in with the one you made locally — same DB, so the account is there.

## Subsequent deploys

Just push to `main`:
```bash
git push
```

Vercel auto-deploys on every push. Preview URL for every non-main branch.

## Custom domain (optional)

Project → Settings → Domains → Add. Vercel walks you through the DNS.
Update `AUTH_URL` and `APP_URL` env vars to the custom domain after it verifies.

## Limits on the Free plan

- 100 GB bandwidth / month
- 100 GB-hours serverless compute / month
- 10-second function timeout (our slowest endpoint is ~3s today, so fine)
- 1 GB memory per function
- Non-commercial use. If you sell Codru as SaaS, switch to Pro ($20/mo/member).

## When something's slow in production

- Vercel dashboard → Analytics → shows which routes are slow.
- Vercel → Deployments → pick a deployment → Function Logs → tail logs.
- Each Prisma query logs its duration by default; grep for `prisma:query`.
