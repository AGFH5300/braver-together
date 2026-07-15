# BraverTogether

BraverTogether is a TanStack Start application for teen-friendly digital legal literacy, online-safety resources, advisor messaging, and contract analysis.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- A Supabase project
- An OpenAI-compatible API only when using the Contract Decoder

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

The development server runs at `http://localhost:3000` unless that port is already occupied.

Fill in the public Supabase values in `.env`:

```dotenv
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Server functions use the corresponding server-only names. The URL and publishable key may contain the same values as above; never expose the service-role key through a `VITE_` variable:

```dotenv
SUPABASE_URL=your-project-url
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADVISOR_PASSCODE=use-a-long-random-passcode
```

Apply the SQL files under `supabase/migrations/` to the intended Supabase project before using profiles, advisors, conversations, messages, or reports.

For the Contract Decoder, also provide:

```dotenv
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=your-model-id
```

`AI_BASE_URL` may point to another OpenAI-compatible provider.

## Google sign-in

Enable Google under **Supabase Dashboard → Authentication → Providers**. Add the local and deployed `/auth` URLs to Supabase's allowed redirect URLs:

```text
http://localhost:3000/auth
https://your-domain.example/auth
```

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

Run every verification step with:

```bash
npm run check
```

## Production

```bash
npm run build
npm start
```

The production build is generated under `.output/` and the Node server listens on the platform-provided port.
