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

The development server prints its local URL in the terminal.

Fill in `.env` before opening pages that use authentication or Supabase data:

```dotenv
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

For the Contract Decoder, also provide:

```dotenv
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=your-model-id
```

`AI_BASE_URL` may point to another OpenAI-compatible provider.

## Google sign-in

Enable Google under **Supabase Dashboard → Authentication → Providers**. Add the local and deployed `/auth` URLs to Supabase's allowed redirect URLs, for example:

```text
http://localhost:3000/auth
https://your-domain.example/auth
```

Use the exact port printed by the development server if it differs.

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

The production build is generated under `.output/`.
