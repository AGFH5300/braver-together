# Optional free AI

Configuration prepared September 13, 2026. No live key is included or configured by this branch.

- Endpoint: `https://api.groq.com/openai/v1`
- Model: `openai/gpt-oss-20b`
- Decoder structured outputs: `true`
- Secrets: `DECODER_AI_API_KEY`, `SUPPORT_AI_API_KEY`, or shared `AI_API_KEY`.
- Use a Groq Free organization. Do not upgrade to paid Developer billing. Free-plan rate limits return HTTP 429. A key from a paid organization can incur charges; code cannot infer its billing plan.

Official sources inspected:
- https://console.groq.com/docs/rate-limits — free-plan model limits and 429 behavior.
- https://console.groq.com/docs/models — current production model catalog.
- https://console.groq.com/docs/structured-outputs — GPT-OSS 20B supports structured output.
- https://console.groq.com/docs/your-data — content can be retained for reliability/abuse monitoring for up to 30 days; all customers can enable Zero Data Retention in Data Controls. Enable ZDR before processing teen support data. Do not enable training/data sharing or persistence features.
- https://console.groq.com/docs/billing-faqs — paid Developer billing is distinct from a free organization.

The account-specific Free status and no-card signup flow must be confirmed in the owner's Groq account before adding a key. No payment method or plan upgrade is authorized by this work.

Default application limits: decoder 10/day per hashed request address; support 20/day per authenticated member. The hosting proxy must sanitize forwarded IP headers. Provider-wide limits can be lower than the sum of member allowances. An outage/limit must leave the human queue usable. The decoder retains its basic scan.

Test on Replit with non-sensitive sample policies: successful structured output, verbatim quotes, empty/short input, prompt-injection text, long input, provider outage and daily limit. No live provider test can pass without a configured key.
