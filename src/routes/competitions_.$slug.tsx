import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { ExternalLink, Mic2 } from 'lucide-react';

import { SiteLayout, Section, Eyebrow } from '@/components/SiteLayout';
import { getPublicCompetition } from '@/lib/competition.functions';

const date = (value: string | null) => value
  ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
  : 'Not announced';

const closingDate = (value: string | null) => value
  ? date(new Date(Date.parse(value) - 1).toISOString())
  : 'Not announced';

export const Route = createFileRoute('/competitions_/$slug')({
  beforeLoad: ({ params }) => {
    if (params.slug === 'inaugural-digital-rights-essay') {
      throw redirect({ to: '/competitions/$slug', params: { slug: 'digital-legal-rights-essay-2026' }, statusCode: 301 });
    }
  },
  loader: ({ params }) => getPublicCompetition({ data: { slug: params.slug } }),
  head: ({ loaderData: c }) => ({
    meta: [
      { title: `${c?.title ?? 'Competition'} — BraverTogether` },
      { name: 'description', content: c?.summary ?? 'BraverTogether competitions.' },
    ],
    links: c ? [{ rel: 'canonical', href: `https://bravertogether.site/competitions/${c.slug}` }] : [],
  }),
  component: Competition,
});

function Competition() {
  const c = Route.useLoaderData();

  if (c.category === 'public-speaking') {
    return <PartnerSpeakingCompetition competition={c} />;
  }

  const prompts = Array.isArray(c.prompts)
    ? c.prompts.filter((prompt): prompt is string => typeof prompt === 'string')
    : [];

  return (
    <SiteLayout>
      <div className="bg-hero">
        <Section>
          <Eyebrow>{c.acceptingSubmissions ? 'Submissions open' : 'Submissions closed'}</Eyebrow>
          <h1 className="mt-5 max-w-4xl text-4xl font-bold sm:text-6xl">{c.title}</h1>
          <p className="mt-6 max-w-3xl text-lg text-muted-foreground">{c.summary}</p>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Eligibility', c.minimum_age === null ? `${c.maximum_age} years old and under` : `Ages ${c.minimum_age}–${c.maximum_age}`],
              ['Word limit', c.maximum_words ? `Maximum ${c.maximum_words.toLocaleString()} words` : 'See rules'],
              ['Submissions', `${date(c.opens_at)} – ${closingDate(c.closes_at)}`],
              ['Results', date(c.results_at)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border bg-card p-5">
                <dt className="text-sm text-teal">{label}</dt>
                <dd className="mt-2 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">Submission dates use UTC.</p>
        </Section>
      </div>

      <Section className="max-w-5xl">
        <h2 className="text-3xl font-bold">Choose one prompt</h2>
        <div className="mt-6 space-y-5">
          {prompts.length === 0 && <p role="status" className="text-muted-foreground">Competition prompts have not been published yet. Please check back before preparing your entry.</p>}
          {prompts.map((prompt, i) => (
            <article key={i} className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold text-teal">Prompt {i + 1}</h3>
              <p className="mt-3 leading-relaxed">{prompt}</p>
            </article>
          ))}
        </div>

        <h2 className="mt-12 text-3xl font-bold">Submission rules</h2>
        <p className="mt-5 whitespace-pre-line leading-relaxed text-muted-foreground">{c.public_rules}</p>

        <h2 className="mt-10 text-3xl font-bold">Recognition</h2>
        <p className="mt-5 leading-relaxed">{c.prize_text}</p>

        <h2 className="mt-10 text-3xl font-bold">Make your argument count</h2>
        <p className="mt-5 text-muted-foreground">Develop a clear argument, use accurate evidence, consider other perspectives and write in your own voice.</p>

        {c.category === 'essay' && (
          <Link
            to="/essay-submission"
            search={{ competition: c.slug }}
            className="mt-8 inline-flex rounded-full bg-navy px-6 py-3 font-semibold text-white"
          >
            {c.acceptingSubmissions ? 'Submit your essay' : 'View your submission'}
          </Link>
        )}
      </Section>
    </SiteLayout>
  );
}

function PartnerSpeakingCompetition({
  competition: c,
}: {
  competition: ReturnType<typeof Route.useLoaderData>;
}) {
  return (
    <SiteLayout>
      <div className="bg-hero">
        <Section>
          <Eyebrow>Vidolo x BraverTogether · {c.acceptingSubmissions ? 'Entries open' : 'Entries closed'}</Eyebrow>
          <div className="mt-5 flex max-w-4xl items-start gap-4">
            <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal/10 text-teal sm:flex">
              <Mic2 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-4xl font-bold sm:text-6xl">{c.title}</h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">{c.summary}</p>
            </div>
          </div>

          <dl className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Format', '3–5 minute speech'],
              ['Entry fee', 'Free'],
              ['Competition dates', `${date(c.opens_at)} – ${closingDate(c.closes_at)}`],
              ['Hosted with', 'Vidolo'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <dt className="text-sm font-medium text-teal">{label}</dt>
                <dd className="mt-2 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>

      <Section className="max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <Eyebrow>Quick brief</Eyebrow>
            <h2 className="mt-4 text-3xl font-bold">Make the case. Build the law. Persuade the panel.</h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              You take the role of the President of a fictional country facing a major AI-infrastructure decision. Choose one of the proposed developments, create legal safeguards for the environmental and infrastructure risks, and deliver a problem-solution speech persuading the judges that your approach is the strongest.
            </p>

            <div className="mt-8 rounded-2xl border border-border bg-secondary/45 p-6">
              <h3 className="text-xl font-bold">Before you enter</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Participants are required to complete both the Vidolo Global and BraverTogether lessons on the competition portal.
              </p>
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-bold">Recognition</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{c.prize_text}</p>
            </div>
          </div>

          <aside className="rounded-3xl border border-teal/25 bg-teal/8 p-6 sm:p-7">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Full competition details</div>
            <h2 className="mt-3 text-2xl font-bold">Continue on Vidolo.org</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We’re keeping this page intentionally brief. The complete scenario, fact sheet, rules, judging process, requirements and submission flow are published by Vidolo.
            </p>
            {c.rules_url && (
              <a
                href={c.rules_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                View full details on Vidolo.org <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Always check Vidolo for the latest official competition information before preparing or submitting your entry.
            </p>
          </aside>
        </div>
      </Section>
    </SiteLayout>
  );
}
