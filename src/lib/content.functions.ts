import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export type ResourceCategory = {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
};

export type ResourceVideo = {
  id: string;
  youtube_video_id: string;
  title: string;
  description: string;
  category_id: string | null;
  duration_text: string | null;
  thumbnail_url: string | null;
  comments_enabled: boolean;
  sort_order: number;
};

export type YouTubeComment = {
  id: string;
  author: string;
  avatarUrl: string | null;
  text: string;
  likeCount: number;
  publishedAt: string;
};

type CommentCacheEntry = {
  expiresAt: number;
  comments: YouTubeComment[];
};

const commentCache = new Map<string, CommentCacheEntry>();
const COMMENT_TTL_MS = 60 * 60 * 1000;

export const getResourceLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const [categoriesResult, videosResult] = await Promise.all([
    supabase
      .from("resource_categories")
      .select("id, label, description, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("resource_videos")
      .select(
        "id, youtube_video_id, title, description, category_id, duration_text, thumbnail_url, comments_enabled, sort_order",
      )
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (categoriesResult.error) throw new Error(categoriesResult.error.message);
  if (videosResult.error) throw new Error(videosResult.error.message);

  return {
    categories: (categoriesResult.data ?? []) as ResourceCategory[],
    videos: (videosResult.data ?? []) as ResourceVideo[],
    commentsConfigured: Boolean(process.env.YOUTUBE_API_KEY),
  };
});

const CommentsInput = z.object({
  videoId: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/),
});

function stripCommentHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export const getYouTubeComments = createServerFn({ method: "GET" })
  .inputValidator((value: unknown) => CommentsInput.parse(value))
  .handler(async ({ data }) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return {
        configured: false as const,
        comments: [] as YouTubeComment[],
        message: "YouTube comments will appear after a YouTube Data API key is configured.",
      };
    }

    const cached = commentCache.get(data.videoId);
    if (cached && cached.expiresAt > Date.now()) {
      return { configured: true as const, comments: cached.comments };
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("videoId", data.videoId);
    url.searchParams.set("maxResults", "20");
    url.searchParams.set("order", "relevance");
    url.searchParams.set("textFormat", "plainText");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) {
      const message = response.status === 403
        ? "Comments are unavailable for this video or the YouTube API key is not enabled."
        : `YouTube returned ${response.status}.`;
      return { configured: true as const, comments: [] as YouTubeComment[], message };
    }

    const payload = (await response.json()) as {
      items?: Array<{
        id?: string;
        snippet?: {
          topLevelComment?: {
            id?: string;
            snippet?: {
              authorDisplayName?: string;
              authorProfileImageUrl?: string;
              textDisplay?: string;
              likeCount?: number;
              publishedAt?: string;
            };
          };
        };
      }>;
    };

    const comments = (payload.items ?? []).flatMap((item) => {
      const comment = item.snippet?.topLevelComment;
      const snippet = comment?.snippet;
      if (!comment?.id || !snippet?.textDisplay) return [];
      return [{
        id: comment.id,
        author: snippet.authorDisplayName || "YouTube user",
        avatarUrl: snippet.authorProfileImageUrl || null,
        text: stripCommentHtml(snippet.textDisplay).slice(0, 1_500),
        likeCount: snippet.likeCount ?? 0,
        publishedAt: snippet.publishedAt || "",
      } satisfies YouTubeComment];
    });

    commentCache.set(data.videoId, {
      comments,
      expiresAt: Date.now() + COMMENT_TTL_MS,
    });

    return { configured: true as const, comments };
  });
