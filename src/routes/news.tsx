import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Suspense } from "react";
import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { Calendar, ArrowRight, PenLine, ExternalLink, Rss } from "lucide-react";
import { getSubstackPosts, type BlogPost } from "@/lib/blog.functions";
import { Skeleton } from "@/components/ui/skeleton";

const postsQuery = queryOptions({
  queryKey: ["substack-posts"],
  queryFn: () => getSubstackPosts(),
  staleTime: 5 * 60 * 1000,
});

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Latest News — BraverTogether" },
      { name: "description", content: "Digital law developments — explained for teens. Privacy, AI, social media regulation, encryption and more." },
      { property: "og:title", content: "Latest News — BraverTogether" },
      { property: "og:description", content: "Current events in digital law, written for real teens." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  component: News,
});

function formatDate(d: string): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function PostsList() {
  const { data } = useSuspenseQuery(postsQuery);

  if (data.error || data.posts.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
        <Rss className="h-8 w-8 text-teal mx-auto mb-3" />
        <h3 className="font-display text-2xl font-bold mb-2">No posts yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
          New articles will appear here automatically as soon as they're published on our Substack.
        </p>
        <a
          href="https://bravertogether31.substack.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
        >
          Visit our Substack <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {data.error && (
          <p className="text-[11px] text-muted-foreground/60 mt-4">Feed error: {data.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {data.posts.map((p: BlogPost) => (
        <a
          key={p.link}
          href={p.link}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-card hover:border-teal/40 transition flex flex-col"
        >
          <div className="h-48 bg-mesh relative overflow-hidden">
            {p.coverImage ? (
              <img src={p.coverImage} alt={p.title} loading="lazy" className="h-full w-full object-cover opacity-95 group-hover:scale-105 transition-transform duration-700" />
            ) : (
              <div className="absolute inset-0 dot-pattern opacity-30" />
            )}
            <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur px-3 py-1 text-xs font-semibold text-navy-deep">
              <Rss className="h-3 w-3 text-teal" /> Substack
            </div>
          </div>
          <div className="p-6 flex flex-col flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <Calendar className="h-3.5 w-3.5" /> {formatDate(p.pubDate)} · {p.author}
            </div>
            <h2 className="font-display text-2xl font-bold leading-tight mb-2 group-hover:text-teal transition">{p.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{p.excerpt}…</p>
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal">
              Read on Substack <ExternalLink className="h-3.5 w-3.5" />
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

function PostsLoadingSkeleton() {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
          <Skeleton className="h-48 w-full rounded-none" />
          <div className="p-6 space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function News() {
  return (
    <SiteLayout>
      <div className="bg-hero relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="py-24 relative">
          <Eyebrow>Latest News & Blog</Eyebrow>
          <h1 className="mt-4 text-5xl sm:text-6xl font-bold max-w-3xl text-navy-deep">Understanding digital law as it happens.</h1>
          <p className="mt-6 text-navy-deep/70 max-w-2xl text-lg">
            Privacy laws change. Platforms update policies. Governments debate online safety. Every article here answers one question: <em className="text-teal not-italic font-semibold">Why should a teenager care about this?</em>
          </p>
        </Section>
      </div>

      <Section>
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <Eyebrow>Live from our Substack</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold">Latest posts</h2>
          </div>
          <a
            href="https://bravertogether31.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-teal/50 hover:text-teal transition"
          >
            Subscribe on Substack <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <Suspense fallback={<PostsLoadingSkeleton />}>
          <PostsList />
        </Suspense>
      </Section>

      <div className="bg-secondary/50 border-y border-border">
        <Section>
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <Eyebrow>What every article includes</Eyebrow>
              <h2 className="mt-4 text-4xl font-bold">A consistent format you can trust.</h2>
              <p className="mt-4 text-muted-foreground">Every story is structured the same way so you always know what you're getting.</p>
            </div>
            <div className="space-y-3">
              {[
                { t: "What Happened?", d: "A clear summary of the event, policy change, or court decision." },
                { t: "Why Does It Matter?", d: "The broader significance of the issue." },
                { t: "How Could It Affect Teens?", d: "A practical breakdown of the impact on young people." },
                { t: "Key Terms Explained", d: "Simple definitions of any legal or technical terminology." },
                { t: "Further Reading", d: "Links to trusted sources to explore the topic deeper." },
              ].map((s) => (
                <div key={s.t} className="rounded-xl border border-border bg-card p-4">
                  <div className="font-semibold text-sm mb-1">{s.t}</div>
                  <div className="text-xs text-muted-foreground">{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>

      <Section>
        <div className="relative overflow-hidden rounded-3xl bg-mesh p-10 sm:p-14 text-white">
          <div className="absolute inset-0 grid-pattern opacity-20" />
          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Eyebrow>Become a Contributor</Eyebrow>
              <h2 className="mt-4 text-3xl sm:text-4xl font-bold">Help explain the digital world.</h2>
              <p className="mt-3 text-white/80">
                If you're interested in law, technology, policy or journalism — apply to join our team of teen-friendly writers. Once approved, you'll get publishing access to the BraverTogether Substack and your posts appear here automatically.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur p-6 border border-white/10">
              <div className="flex items-center gap-2 text-teal-soft mb-3"><PenLine className="h-4 w-4" /> <span className="text-xs font-semibold uppercase tracking-widest">Apply to write</span></div>
              <p className="text-sm text-white/80 mb-5">Send a brief application outlining your interests and why you'd like to contribute.</p>
              <a href="mailto:hello@bravertogether.org?subject=Contributor%20Application" className="inline-flex items-center gap-2 rounded-full bg-teal-soft text-navy-deep px-5 py-2.5 text-sm font-semibold hover:brightness-110 transition">
                Submit an application <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </Section>
    </SiteLayout>
  );
}
