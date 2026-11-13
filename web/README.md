# AIBizScanner internal report testing app (`web/`)

Private, admin-only Next.js app for testing whether the Full Business Diagnostic
(`../design/reports/full-business-diagnostic.dc.html`) can be filled accurately and
automatically. See the build brief: [`../docs/build/internal-testing-app.md`](../docs/build/internal-testing-app.md).

Stack: Next.js (App Router, TypeScript strict) · Supabase (Postgres, Auth) via `@supabase/ssr` · zod · Vitest.

## Local development

Requirements: Node 22+, npm.

```bash
cd web
npm install
cp .env.example .env.local   # then fill in values (see below)
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run typecheck` | Generate Next route types, then `tsc --noEmit` |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript rules) |
| `npm test` | Unit tests (Vitest, `src/**/*.test.ts`) |
| `npm run build` | Production build (works without env vars; they are read at request time) |

CI (`.github/workflows/ci.yml`) runs install, typecheck, lint, unit tests and build on every pull request.

## Environment variables

Copy `.env.example` to `.env.local`. Never commit real values.

| Name | Where to find it | Used by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → Data API → Project URL | browser + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard → Project Settings → API Keys → publishable key (the legacy `anon` key also works) | browser + server |

Later milestones add server-only variables; they are listed here as they are introduced.
