import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { XMLParser } from "fast-xml-parser";

export type BlogPost = {
  title: string;
  link: string;
  pubDate: string;
  excerpt: string;
  coverImage: string | null;
  author: string;
};

const SUBSTACK_URL = "https://bravertogether31.substack.com/feed";
const memoryCache = new Map<string, { posts: BlogPost[]; expiresAt: number }>();
const TTL_MS = 10 * 60 * 1000;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return text(record["#text"] ?? record["__cdata"] ?? "");
  }
  return "";
}

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function firstImage(html: string, item: Record<string, unknown>): string | null {
  const enclosure = item.enclosure as Record<string, unknown> | undefined;
  const media = item["media:content"] as Record<string, unknown> | undefined;
  const thumbnail = item["media:thumbnail"] as Record<string, unknown> | undefined;
  const candidate = text(enclosure?.["@_url"] ?? media?.["@_url"] ?? thumbnail?.["@_url"]);
  if (candidate.startsWith("http")) return candidate;
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
}

function parseFeed(xml: string): BlogPost[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: true, trimValues: true });
  const parsed = parser.parse(xml) as Record<string, any>;
  const rssItems = asArray<Record<string, unknown>>(parsed?.rss?.channel?.item);
  const atomItems = asArray<Record<string, unknown>>(parsed?.feed?.entry);
  const items = rssItems.length ? rssItems : atomItems;

  return items.flatMap((item) => {
    const links = asArray<any>(item.link);
    const link = text(item.link) || text(links.find((entry) => entry?.["@_rel"] === "alternate")?.["@_href"]) || text(links[0]?.["@_href"]);
    if (!link.startsWith("http")) return [];
    const description = text(item.description ?? item.summary);
    const content = text(item["content:encoded"] ?? item.content) || description;
    return [{
      title: stripHtml(text(item.title) || "Untitled"),
      link,
      pubDate: text(item.pubDate ?? item.published ?? item.updated),
      excerpt: stripHtml(description || content).slice(0, 260),
      coverImage: firstImage(content, item),
      author: text(item["dc:creator"] ?? (item.author as any)?.name ?? item.author) || "BraverTogether",
    }];
  }).filter((post, index, all) => all.findIndex((candidate) => candidate.link === post.link) === index)
    .sort((a, b) => Date.parse(b.pubDate || "0") - Date.parse(a.pubDate || "0")).slice(0, 20);
}

async function fetchFeed(): Promise<BlogPost[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(SUBSTACK_URL, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "BraverTogether/1.0 (+https://bravertogether.org)" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Substack returned ${response.status}`);
      const posts = parseFeed(await response.text());
      if (!posts.length) throw new Error("The Substack feed contained no readable posts");
      return posts;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  throw lastError;
}

async function readCachedPosts(): Promise<BlogPost[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("news_posts").select("title, link, pub_date, excerpt, cover_image, author")
      .order("pub_date", { ascending: false }).limit(20);
    return (data ?? []).map((post) => ({
      title: post.title, link: post.link, pubDate: post.pub_date ?? "", excerpt: post.excerpt,
      coverImage: post.cover_image, author: post.author,
    }));
  } catch { return []; }
}

async function cachePosts(posts: BlogPost[]) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("news_posts").upsert(posts.map((post) => ({
      external_id: createHash("sha256").update(post.link).digest("hex"), title: post.title, link: post.link,
      pub_date: post.pubDate ? new Date(post.pubDate).toISOString() : null, excerpt: post.excerpt,
      cover_image: post.coverImage, author: post.author, synced_at: new Date().toISOString(),
    })), { onConflict: "external_id" });
  } catch (error) { console.error("Could not cache Substack posts", error); }
}

export const getSubstackPosts = createServerFn({ method: "GET" }).handler(async () => {
  const cached = memoryCache.get(SUBSTACK_URL);
  if (cached && cached.expiresAt > Date.now()) return { posts: cached.posts, source: SUBSTACK_URL, stale: false };
  try {
    const posts = await fetchFeed();
    memoryCache.set(SUBSTACK_URL, { posts, expiresAt: Date.now() + TTL_MS });
    void cachePosts(posts);
    return { posts, source: SUBSTACK_URL, stale: false };
  } catch (error) {
    const posts = await readCachedPosts();
    return { posts, source: SUBSTACK_URL, stale: posts.length > 0, error: (error as Error).message };
  }
});
