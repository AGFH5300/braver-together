import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { SiteLayout, Section, Eyebrow } from '@/components/SiteLayout';
import { getPublicCompetition } from '@/lib/competition.functions';
const date = (value: string | null) => value ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : 'Not announced';
export const Route = createFileRoute('/competitions_/$slug')({
  beforeLoad: ({ params }) => {
    if (params.slug === 'inaugural-digital-rights-essay') {
      throw redirect({ to: '/competitions/$slug', params: { slug: 'digital-legal-rights-essay-2026' }, statusCode: 301 });
    }
  },
  loader: ({ params }) => getPublicCompetition({ data: { slug: params.slug } }),
  head: ({ loaderData: c }) => ({ meta: [{ title: `${c?.title ?? 'Competition'} — BraverTogether` }, { name: 'description', content: c?.summary ?? 'BraverTogether competitions.' }], links: c ? [{ rel: 'canonical', href: `https://bravertogether.site/competitions/${c.slug}` }] : [] }),
  component: Competition,
});
function Competition() {
 const c = Route.useLoaderData();
 const prompts = Array.isArray(c.prompts) ? c.prompts.filter((prompt): prompt is string => typeof prompt === 'string') : [];
 return <SiteLayout><div className="bg-hero"><Section><Eyebrow>{c.acceptingSubmissions ? 'Submissions open' : 'Submissions closed'}</Eyebrow><h1 className="mt-5 max-w-4xl text-4xl font-bold sm:text-6xl">{c.title}</h1><p className="mt-6 max-w-3xl text-lg text-muted-foreground">{c.summary}</p><dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Eligibility', c.minimum_age === null ? `${c.maximum_age} years old and under` : `Ages ${c.minimum_age}–${c.maximum_age}`], ['Word limit', c.maximum_words ? `Maximum ${c.maximum_words.toLocaleString()} words` : 'See rules'], ['Submissions', `${date(c.opens_at)} – ${date(c.closes_at ? new Date(Date.parse(c.closes_at)-1).toISOString() : null)}`], ['Results', date(c.results_at)]].map(([label,value])=><div key={label} className="rounded-2xl border bg-card p-5"><dt className="text-sm text-teal">{label}</dt><dd className="mt-2 font-semibold">{value}</dd></div>)}</dl><p className="mt-3 text-sm text-muted-foreground">Submission dates use UTC.</p></Section></div><Section className="max-w-5xl"><h2 className="text-3xl font-bold">Choose one prompt</h2><div className="mt-6 space-y-5">{prompts.length === 0 && <p role="status" className="text-muted-foreground">Competition prompts have not been published yet. Please check back before preparing your entry.</p>}{prompts.map((prompt,i)=><article key={i} className="rounded-2xl border bg-card p-6"><h3 className="font-semibold text-teal">Prompt {i+1}</h3><p className="mt-3 leading-relaxed">{prompt}</p></article>)}</div><h2 className="mt-12 text-3xl font-bold">Submission rules</h2><p className="mt-5 whitespace-pre-line leading-relaxed text-muted-foreground">{c.public_rules}</p><h2 className="mt-10 text-3xl font-bold">Recognition</h2><p className="mt-5 leading-relaxed">{c.prize_text}</p><h2 className="mt-10 text-3xl font-bold">Make your argument count</h2><p className="mt-5 text-muted-foreground">Develop a clear argument, use accurate evidence, consider other perspectives and write in your own voice.</p>{c.category === 'essay' && <Link to="/essay-submission" search={{ competition: c.slug }} className="mt-8 inline-flex rounded-full bg-navy px-6 py-3 font-semibold text-white">{c.acceptingSubmissions ? 'Submit your essay' : 'View your submission'}</Link>}</Section></SiteLayout>;
}
