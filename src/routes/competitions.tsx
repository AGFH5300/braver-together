import { createFileRoute, Link } from '@tanstack/react-router';
import { SiteLayout, Section, Eyebrow } from '@/components/SiteLayout';
import { listPublicCompetitions } from '@/lib/competition.functions';
export const Route = createFileRoute('/competitions')({
  head: () => ({ meta: [{ title: 'Competitions — BraverTogether' }, { name: 'description', content: 'Explore BraverTogether competitions in digital legal rights.' }], links: [{ rel: 'canonical', href: 'https://bravertogether.site/competitions' }] }),
  loader: () => listPublicCompetitions(), component: Competitions,
});
function Competitions() {
  const competitions = Route.useLoaderData();
  return <SiteLayout><Section><Eyebrow>Share your perspective</Eyebrow><h1 className="mt-4 text-4xl font-bold sm:text-6xl">Competitions</h1><p className="mt-5 max-w-2xl text-muted-foreground">Explore digital rights, develop your ideas and make your voice heard.</p><div className="mt-10 grid gap-6 md:grid-cols-2">{competitions.map(c => <article key={c.id} className="rounded-3xl border bg-card p-7 shadow-card"><p className="text-sm font-semibold text-teal">{c.acceptingSubmissions ? 'Submissions open' : 'Submissions closed'}</p><h2 className="mt-3 text-2xl font-bold">{c.title}</h2><p className="mt-4 text-muted-foreground">{c.summary}</p><Link to="/competitions/$slug" params={{ slug: c.slug }} className="mt-6 inline-flex rounded-full bg-navy px-5 py-3 font-semibold text-white">View competition</Link></article>)}</div>{!competitions.length && <p className="mt-8 rounded-2xl border p-6">No competitions are announced yet. Please check back soon.</p>}</Section></SiteLayout>;
}
