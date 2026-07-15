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

type CacheEntry = { data: BlogPost[]; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

// User said "@bravertogether31" — assuming Substack subdomain matches.
// Swap this one string if the actual handle differs.
const SUBSTACK_URL = "https://bravertogether31.substack.com/feed";

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstImage(html: string): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

export const getSubstackPosts = createServerFn({ method: "GET" }).handler(async (): Promise<{
  posts: BlogPost[];
  source: string;
  error?: string;
}> => {
  const cached = cache.get(SUBSTACK_URL);
  if (cached && cached.expiresAt > Date.now()) {
    return { posts: cached.data, source: SUBSTACK_URL };
  }

  try {
    const res = await fetch(SUBSTACK_URL, {
      headers: { "User-Agent": "BraverTogether-Site/1.0" },
    });
    if (!res.ok) {
      return { posts: [], source: SUBSTACK_URL, error: `Feed returned ${res.status}` };
    }
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const json = parser.parse(xml);

    const itemsRaw = json?.rss?.channel?.item;
    const items = Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : [];

    const posts: BlogPost[] = items.slice(0, 12).map((it: Record<string, unknown>) => {
      const description = String(it.description ?? "");
      const contentEncoded = String((it as Record<string, unknown>)["content:encoded"] ?? "");
      const fullHtml = contentEncoded || description;
      return {
        title: String(it.title ?? "Untitled"),
        link: String(it.link ?? "#"),
        pubDate: String(it.pubDate ?? ""),
        excerpt: stripHtml(description).slice(0, 220),
        coverImage: extractFirstImage(fullHtml),
        author: String(it["dc:creator"] ?? "BraverTogether"),
      };
    });

    cache.set(SUBSTACK_URL, { data: posts, expiresAt: Date.now() + TTL_MS });
    return { posts, source: SUBSTACK_URL };
  } catch (e) {
    return { posts: [], source: SUBSTACK_URL, error: (e as Error).message };
  }
});
