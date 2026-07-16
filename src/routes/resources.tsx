import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  BrainCircuit,
  ExternalLink,
  Lock,
  MessageCircle,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { SiteLayout, Section, Eyebrow } from "@/components/SiteLayout";
import { cn } from "@/lib/utils";
import {
  getResourceLibrary,
  getYouTubeComments,
  type ResourceVideo,
  type YouTubeComment,
} from "@/lib/content.functions";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Video Resource Library — BraverTogether" },
      {
        name: "description",
        content:
          "Free teen-friendly videos on privacy, social media law, digital contracts, online safety, AI, and digital rights.",
      },
      { property: "og:title", content: "Video Resource Library — BraverTogether" },
      { property: "og:description", content: "Understand your digital rights through short, practical videos." },
    ],
  }),
  loader: () => getResourceLibrary(),
  component: Resources,
});

const categoryIcons = {
  privacy: Lock,
  social: Users,
  contracts: ShieldCheck,
  safety: ShieldCheck,
  ai: BrainCircuit,
  rights: Sparkles,
} as const;

function Resources() {
  const { categories, videos, commentsConfigured } = Route.useLoaderData();
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ResourceVideo | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return videos.filter((video) => {
      const categoryMatches = activeCategory === "all" || video.category_id === activeCategory;
      const queryMatches =
        !normalized ||
        video.title.toLowerCase().includes(normalized) ||
        video.description.toLowerCase().includes(normalized);
      return categoryMatches && queryMatches;
    });
  }, [activeCategory, query, videos]);

  return (
    <SiteLayout>
      <div className="bg-hero relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <Section className="py-24 relative">
          <Eyebrow><Video className="h-3.5 w-3.5" /> Video Resource Library</Eyebrow>
          <h1 className="mt-4 text-5xl sm:text-6xl font-bold max-w-3xl text-navy-deep">
            Digital law explained through videos you can actually follow.
          </h1>
          <p className="mt-6 text-navy-deep/70 max-w-2xl text-lg">
            Short, practical lessons on privacy, contracts, online safety, AI and your rights. Videos will appear here as the BraverTogether series is published.
          </p>
        </Section>
      </div>

      <Section>
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {[
            { t: "Watch at your pace", d: "Pause, replay and revisit any topic whenever you need it." },
            { t: "Built for teens", d: "Clear explanations without assuming prior legal knowledge." },
            { t: "Optional YouTube discussion", d: "Public video comments can appear here once the YouTube API is connected." },
          ].map((item) => (
            <div key={item.t} className="rounded-2xl border border-border bg-card p-5">
              <div className="font-semibold mb-1">{item.t}</div>
              <p className="text-sm text-muted-foreground">{item.d}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between mb-8">
          <div className="flex flex-wrap gap-2">
            <FilterButton active={activeCategory === "all"} onClick={() => setActiveCategory("all")}>
              <Video className="h-3.5 w-3.5" /> All videos
            </FilterButton>
            {categories.map((category) => {
              const Icon = categoryIcons[category.id as keyof typeof categoryIcons] ?? Video;
              return (
                <FilterButton
                  key={category.id}
                  active={activeCategory === category.id}
                  onClick={() => setActiveCategory(category.id)}
                >
                  <Icon className="h-3.5 w-3.5" /> {category.label}
                </FilterButton>
              );
            })}
          </div>

          <label className="relative block w-full lg:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search videos"
              className="w-full rounded-full border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-teal/30"
            />
          </label>
        </div>

        {videos.length === 0 ? (
          <ComingSoon />
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <h2 className="mt-4 text-2xl font-bold">No videos match that search.</h2>
            <button
              onClick={() => { setQuery(""); setActiveCategory("all"); }}
              className="mt-4 text-sm font-semibold text-teal hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((video) => (
              <VideoCard key={video.id} video={video} onSelect={() => setSelected(video)} />
            ))}
          </div>
        )}
      </Section>

      {selected && (
        <VideoViewer
          video={selected}
          commentsConfigured={commentsConfigured}
          onClose={() => setSelected(null)}
        />
      )}
    </SiteLayout>
  );
}

function FilterButton({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
        active
          ? "border-navy bg-navy text-white"
          : "border-border bg-card text-muted-foreground hover:border-teal/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ComingSoon() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-10 sm:p-16 text-center">
      <div className="absolute inset-0 dot-pattern opacity-25" />
      <div className="relative mx-auto max-w-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-mesh text-white shadow-glow">
          <Play className="h-7 w-7 fill-current" />
        </div>
        <h2 className="mt-6 text-3xl sm:text-4xl font-bold">The first video lessons are being produced.</h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          The library and database are ready. Once a YouTube video is added and marked as published, it will automatically appear here with an embedded privacy-enhanced player.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-teal/10 px-4 py-2 text-sm font-semibold text-teal">
          <Sparkles className="h-4 w-4" /> No placeholder PDFs or broken download buttons
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video, onSelect }: { video: ResourceVideo; onSelect: () => void }) {
  const thumbnail = video.thumbnail_url || `https://i.ytimg.com/vi/${video.youtube_video_id}/hqdefault.jpg`;
  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:border-teal/40 hover:shadow-card">
      <button onClick={onSelect} className="relative block aspect-video w-full overflow-hidden bg-navy text-left">
        <img src={thumbnail} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-navy-deep/15 transition group-hover:bg-navy-deep/30" />
        <span className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-navy shadow-lg">
          <Play className="ml-1 h-5 w-5 fill-current" />
        </span>
        {video.duration_text && (
          <span className="absolute bottom-3 right-3 rounded bg-black/75 px-2 py-1 text-xs font-semibold text-white">
            {video.duration_text}
          </span>
        )}
      </button>
      <div className="p-5">
        <h2 className="font-display text-xl font-bold leading-tight">{video.title}</h2>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{video.description}</p>
        <button onClick={onSelect} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal hover:underline">
          Watch lesson <Play className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

function VideoViewer({ video, commentsConfigured, onClose }: {
  video: ResourceVideo;
  commentsConfigured: boolean;
  onClose: () => void;
}) {
  const loadComments = useServerFn(getYouTubeComments);
  const [comments, setComments] = useState<YouTubeComment[] | null>(null);
  const [commentMessage, setCommentMessage] = useState<string | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);

  async function showComments() {
    setLoadingComments(true);
    try {
      const result = await loadComments({ data: { videoId: video.youtube_video_id } });
      setComments(result.comments);
      setCommentMessage("message" in result ? result.message ?? null : null);
    } catch {
      setComments([]);
      setCommentMessage("Comments could not be loaded right now.");
    } finally {
      setLoadingComments(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-navy-deep/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto my-6 max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-teal">Video lesson</div>
            <h2 className="mt-1 text-2xl font-bold">{video.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">Close</button>
        </div>

        <div className="aspect-video bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtube_video_id}?rel=0`}
            title={video.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="leading-relaxed text-muted-foreground">{video.description}</p>
            <a
              href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-teal/50"
            >
              Open on YouTube <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <aside className="rounded-2xl border border-border bg-secondary/30 p-4">
            <div className="flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4 text-teal" /> YouTube discussion</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Public comments are shown from YouTube and remain subject to YouTube moderation.
            </p>

            {comments === null ? (
              <button
                onClick={showComments}
                disabled={loadingComments || !video.comments_enabled}
                className="mt-4 w-full rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loadingComments ? "Loading…" : commentsConfigured ? "Show top comments" : "Comments not connected yet"}
              </button>
            ) : comments.length === 0 ? (
              <p className="mt-4 rounded-xl bg-card p-3 text-xs text-muted-foreground">{commentMessage || "No public comments are available."}</p>
            ) : (
              <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="text-xs font-semibold">{comment.author}</div>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{comment.text}</p>
                    {comment.likeCount > 0 && <div className="mt-2 text-[10px] text-muted-foreground">{comment.likeCount} likes</div>}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
