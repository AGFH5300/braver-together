# BraverTogether

Digital legal literacy for young people. TanStack Start / Router, React 19, TypeScript, Tailwind 4 and Supabase (Auth, Postgres, Storage and Realtime).

## Run locally or on Replit

Use Node 22+ and npm 10+. Run `npm ci`, copy `.env.example` to a local ignored `.env` or enter its variables in Replit Secrets, then run `npm run dev`. The default port is 3000. `npm run dev -- --port 5000` selects another port.

Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`. `SUPABASE_URL` can override the shared URL on the server. Never put private keys in a `VITE_` variable. Configure your exact test origin in Supabase Auth's Site URL / allowed redirects.

## Schema and security

Apply repository migrations in order using the Supabase CLI or Dashboard. The September migration preserves the existing essay competition ID and entries while updating its approved content. Apply it before testing this branch. It also adds the public advisor directory, moderation fields, atomic support creation/AI limits, and stronger role and upload guards.

All private files remain in private buckets. Server functions authenticate and authorize privileged work; RLS also protects direct Data API access. A public advisor directory record is content, not an Auth account or permission grant. A linked advisor must have a role, approved application and advisor profile flag; partial state fails closed.

`src/integrations/supabase/types.ts` contains the earlier generated baseline. `src/lib/competition-database.types.ts` adds the migration-owned types for the current schema. Regenerate the baseline against the verified live schema after application; do not claim the generated baseline reflects an inaccessible live database.

## Product workflows

- Email OTP signup, then password creation; password sign-in and recovery. Social sign-in is not offered.
- Members create support requests inside Messages. Advisors claim requests without seeing private messages beforehand. Closing, reporting, unread indicators and realtime are supported.
- `/advisors` renders the directory on the server. Unlinked profiles offer the general team queue. Linked, approved advisors can receive direct requests when accepting messages.
- Advisor applications include verified PDF/DOCX CVs. `/admin-advisors` reviews applications; applicants retain member access until approval.
- `/competitions` lists published database records; `/competitions/$slug` shows details. `/essay-submission?competition=<slug>` selects an essay competition. `/admin-competitions` creates hidden drafts, edits content/dates/prompts, and reviews each competition's entries.
- Current competition: Digital Legal Rights Essay Competition, 18 and under, maximum 1,500 words, August 7–October 10 inclusive UTC, results October 25, 2026. Only first place carries a $250 cash prize. Public-speaking drafts must remain hidden until founder-approved details exist.
- Meetings require an assigned human advisor, HTTPS links and the other participant's acceptance. Calendar exports use Google Calendar, Outlook and ICS.
- `/admin-reports` provides report review, conversation context and resolution notes.
- `/privacy`, `/safety` and `/community-guidelines` explain service boundaries and information use.

## Free AI configuration

The default compatible endpoint is Groq and model is `openai/gpt-oss-20b`. Use a **Groq Free organization without upgrading to the paid Developer plan**. The application cannot determine the billing plan associated with a key. See `docs/AI_CONFIGURATION.md` for verified sources, limits and privacy settings.

Set `DECODER_AI_API_KEY` and optionally `SUPPORT_AI_API_KEY`, or one shared `AI_API_KEY`. Base URLs and model names are shown in `.env.example`. No key is bundled. Missing/unavailable AI produces a labeled Basic clause scan for the decoder; support remains in the human queue. Support AI is opt-in. AI-generated quotes must occur in the supplied text. Limits are atomic in Postgres.

YouTube privacy-enhanced embeds need no API key. `YOUTUBE_API_KEY` optionally enables comments and stays server-only.

## Checks

- `npm run check`: build, generated routes, TypeScript, ESLint, unit tests and isolated PostgreSQL tests.
- `npm test`: logic tests and all migrations against PGlite, with disposable local roles and RLS assertions. This does not create real Supabase Auth accounts or replace hosted E2E tests.
- `node scripts/cleanup-pending-uploads.mjs`: dry-run interrupted uploads older than 24 hours. Add `--apply` for cleanup. Existing verified files are excluded. Requires server credentials.
- `node scripts/promote-admin.mjs --help`: trusted administrator bootstrap. The desired account must complete normal signup first; no public bootstrap endpoint exists.

See `docs/PRE_RENDER_PRODUCTION_TEST_CHECKLIST.md` and `docs/READINESS_RESULTS.md`. Replit acceptance and deployment are owner-operated. No production deployment is performed by this branch.

## Production, when the owner is ready

Run `npm run build` then `npm start`. Set the production Auth Site URL and allowed redirects deliberately. Canonicals, social metadata and sitemap use `https://bravertogether.site`. Keep test environments private/noindexed at the hosting layer. Submit the sitemap to Search Console after verifying domain ownership; indexing and ranking are not guaranteed.
