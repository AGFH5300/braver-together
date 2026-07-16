import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ArrowRight, Calendar, ExternalLink, PenLine, Rss } from "lucide-react";

import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { getSubstackPosts, type BlogPost } from "@/lib/blog.functions";

const postsQuery = queryOptions({
  queryKey: ["substack-posts"],
  queryFn: () => getSubstackPosts(),
  staleTime: 5 * 60 * 1000,
});

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Latest News — BraverTogether" },
      { name: "description", content: "Digital law developments explained for teens, including privacy, AI, social media regulation and online safety." },
      { property: "og:title", content: "Latest News — BraverTogether" },
      { property: "og:description", content: "Current events in digital law, written for real teens." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  component: News,
});

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function PostsList() {
  const { data } = useSuspenseQuery(postsQuery);

  if (data.posts.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
        <Rss className="mx-auto mb-3 h-8 w-8 text-teal" />
        <h3 className="font-display text-2xl font-bold">Articles will appear here soon.</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Visit our Substack for the latest BraverTogether writing and subscribe for new posts.
        </p>
        <a href="https://bravertogether31.substack.com" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline">
          Visit our Substack <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div>
      {data.stale && (
        <div className="mb-5 rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
          Showing the most recently saved articles. The live feed will refresh automatically.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {data.posts.map((post: BlogPost) => (
          <a key={post.link} href={post.link} target="_blank" rel="noopener noreferrer" className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-teal/40 hover:shadow-card">
            <div className="relative h-48 overflow-hidden bg-mesh">
              {post.coverImage ? (
                <img src={post.coverImage} alt="" loading="lazy" className="h-full w-full object-cover opacity-95 transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className="absolute inset-0 dot-pattern opacity-30" />
              )}
              <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-navy-deep backdrop-blur">
                <Rss className="h-3 w-3 text-teal" /> Substack
              </div>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> {formatDate(post.pubDate)}{post.author ? ` · ${post.author}` : ""}
              </div>
              <h2 className="mb-2 font-display text-2xl font-bold leading-tight transition group-hover:text-teal">{post.title}</h2>
              <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">{post.excerpt}{post.excerpt ? "…" : ""}</p>
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal">Read on Substack <ExternalLink className="h-3.5 w-3.5" /></div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function PostsLoadingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-border bg-card">
          <Skeleton className="h-48 w-full rounded-none" />
          <div className="space-y-3 p-6"><Skeleton className="h-3 w-32" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>
        </div>
      ))}
    </div>
  );
}

function News() {
  return (
    <SiteLayout>
      <div className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="relative py-24">
          <Eyebrow>Latest News & Blog</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-5xl font-bold text-navy-deep sm:text-6xl">Understanding digital law as it happens.</h1>
          <p className="mt-6 max-w-2xl text-lg text-navy-deep/70">Privacy laws change. Platforms update policies. Governments debate online safety. We explain what these developments mean for young people.</p>
        </Section>
      </div>

      <Section>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><Eyebrow>From our Substack</Eyebrow><h2 className="mt-3 text-3xl font-bold">Latest posts</h2></div>
          <a href="https://bravertogether31.substack.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:border-teal/50 hover:text-teal">
            Subscribe on Substack <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <Suspense fallback={<PostsLoadingSkeleton />}><PostsList /></Suspense>
      </Section>

      <div className="border-y border-border bg-secondary/50">
        <Section>
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div><Eyebrow>What every article includes</Eyebrow><h2 className="mt-4 text-4xl font-bold">A consistent format you can trust.</h2><p className="mt-4 text-muted-foreground">Each story explains the event, why it matters and how it could affect young people.</p></div>
            <div className="space-y-3">
              {[
                ["What happened?", "A clear summary of the event, policy change or court decision."],
                ["Why does it matter?", "The wider significance of the issue."],
                ["How could it affect teens?", "A practical breakdown of the impact on young people."],
                ["Key terms explained", "Simple definitions of legal and technical terminology."],
                ["Further reading", "Trusted sources for exploring the topic in more depth."],
              ].map(([title, description]) => <div key={title} className="rounded-xl border border-border bg-card p-4"><div className="mb-1 text-sm font-semibold">{title}</div><div className="text-xs text-muted-foreground">{description}</div></div>)}
            </div>
          </div>
        </Section>
      </div>

      <Section>
        <div className="relative overflow-hidden rounded-3xl bg-mesh p-10 text-white sm:p-14">
          <div className="absolute inset-0 grid-pattern opacity-20" />
          <div className="relative grid items-center gap-8 md:grid-cols-2">
            <div><Eyebrow>Become a contributor</Eyebrow><h2 className="mt-4 text-3xl font-bold sm:text-4xl">Help explain the digital world.</h2><p className="mt-3 text-white/80">Students interested in law, technology, policy or journalism can apply to contribute teen-friendly articles.</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur">
              <div className="mb-3 flex items-center gap-2 text-teal-soft"><PenLine className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-widest">Apply to write</span></div>
              <p className="mb-5 text-sm text-white/80">Send a short application explaining your interests and what you would like to write about.</p>
              <a href="mailto:hello@bravertogether.org?subject=Contributor%20Application" className="inline-flex items-center gap-2 rounded-full bg-teal-soft px-5 py-2.5 text-sm font-semibold text-navy-deep transition hover:brightness-110">Submit an application <ArrowRight className="h-4 w-4" /></a>
            </div>
          </div>
        </div>
      </Section>
    </SiteLayout>
  );
}
