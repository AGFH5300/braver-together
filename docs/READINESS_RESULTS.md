# Replit handoff — 14 September 2026

Branch: `work/final-production-readiness`. Deployment and merge are reserved for the owner after Replit acceptance.

## Implemented

- Approved Digital Legal Rights Essay Competition content, no minimum age or word count, maximum age 18 and 1,500 words, October 10 closing date, October 25 results; multiple competition pages and administrator draft management.
- Six source-backed advisor biographies and sanitized responsive portraits where supplied. Directory entries do not create login identities. Direct contact requires a linked, approved, public advisor accepting messages.
- Private CV and essay verification, bounded DOCX ZIP/XML checks, conditional file replacement, submission deadline guards, and expired pending-upload cleanup.
- Fail-closed advisor access, restricted pre-claim message visibility, atomic support creation and AI usage limits, and a database guard against AI replies after human assignment or closure.
- Administrator report review, privacy/safety/community pages, public SEO metadata and sitemap, and Team/News redirects.
- Groq-compatible AI configuration, opt-in support AI, explicit basic decoder fallback, and grounded AI quotation checks.

## Verification

`npm run check` runs the production build, TypeScript, ESLint, unit tests, and migration/RLS tests. The database suite applies all migrations to isolated PGlite with Auth/Storage stubs. It tests restricted roles, pre-claim message isolation, unrelated access denial, sequential claim contention, late AI delivery rejection, closed-thread send denial, directory column permissions, and usage limits. These are local database tests, not hosted Supabase end-to-end tests.

`node scripts/smoke-public.mjs` passed against disposable local public-data fixtures: ten public pages, competition content, advisor content/photos, canonical metadata, private noindex, redirects, sitemap, and assets. This checks server-rendered HTML, not browser interaction or visual layout.

## Required for Replit acceptance

1. Install with `npm ci`; configure Replit Secrets from `.env.example`. Never expose service-role or AI keys through `VITE_` variables.
2. Apply repository migrations to the intended Supabase project in order, including `20260913124354_final_competitions_directory_safety.sql`, before testing this branch. Hosted SQL/migration inspection timed out during this work, so application to the live project is unverified. Regenerate baseline database types after verifying the live schema.
3. Use the existing admin promotion script for the intended owner account only after it exists; no live administrator promotion was performed here.
4. Run `npm run dev -- --host 0.0.0.0 --port 5000` and follow `PRE_RENDER_PRODUCTION_TEST_CHECKLIST.md`: email signup/login/reset, member/advisor/admin separation, signed CV/essay uploads and failed replacement, in-place support requests, claim races with two sessions, messaging, meetings, reports, and mobile/keyboard flows.
5. Configure and test the AI provider only if desired. No live AI key/account was available for inference testing. Confirm account limits, billing settings and retention controls using `AI_CONFIGURATION.md`; missing keys intentionally use the documented fallback.

The managed browser could not reach the local preview (`ERR_BLOCKED_BY_CLIENT`). No browser E2E, real email delivery, live storage roundtrip, simultaneous hosted claim race, or live AI response is claimed. No Render service was changed or deployed.
