# BraverTogether

BraverTogether is a TanStack Start application for teen-friendly digital legal literacy, video resources, Substack news, advisor messaging, meeting scheduling and contract analysis.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- A Supabase project
- Optional YouTube and OpenAI-compatible API credentials for the integrations that use them

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

The development server runs at `http://localhost:3000` unless a different port is supplied.

Required browser settings:

```dotenv
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_GOOGLE_AUTH_ENABLED=false
```

Required server settings:

```dotenv
SUPABASE_URL=your-project-url
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Never expose the service-role key through a `VITE_` variable. Apply the SQL files under `supabase/migrations/` before testing profiles, advisor applications, conversations, meetings or AI limits.

## Advisor onboarding

Users apply through `/advisor-application`. Administrators review applications through `/admin-advisors` and can approve, deny, request more information or contact the applicant. Approved users receive the advisor role automatically and can then publish their profile and set their availability.

To grant the first administrator role, add an `admin` row for that user in `public.user_roles` through a trusted Supabase administration workflow. Do not expose an admin-role assignment endpoint to the browser.

## Meetings

Once a human advisor is assigned to a conversation, either participant can propose a date, time and HTTPS meeting link from `/meetings`. The other participant must accept before it is confirmed. Confirmed meetings can be added to Google Calendar, Outlook or downloaded as an `.ics` file.

## Google sign-in

Keep `VITE_GOOGLE_AUTH_ENABLED=false` until Google is configured under **Supabase Dashboard → Authentication → Providers**. Add the local and deployed `/auth` URLs to the allowed redirect URLs, then set the flag to `true`:

```text
http://localhost:3000/auth
https://your-domain.example/auth
```

## Optional YouTube comments

Video embeds work without an API key. Add this only when public comments should appear alongside published resources:

```dotenv
YOUTUBE_API_KEY=your-youtube-data-api-key
```

## Optional AI providers

The support helper and Contract Decoder accept OpenAI-compatible providers and can use separate keys and models:

```dotenv
AI_API_KEY=
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=

SUPPORT_AI_API_KEY=
SUPPORT_AI_BASE_URL=
SUPPORT_AI_MODEL=

DECODER_AI_API_KEY=
DECODER_AI_BASE_URL=
DECODER_AI_MODEL=
DECODER_AI_STRUCTURED_OUTPUTS=true
```

Both features fail closed with a user-friendly unavailable message when credentials are absent. API keys remain server-only, and persistent daily limits are stored in Supabase.

## Checks

```bash
npm run check
```

This generates the route tree through a production build, then runs TypeScript and ESLint.

## Production

```bash
npm run build
npm start
```

The production server is generated under `.output/` and listens on the platform-provided host and port.
