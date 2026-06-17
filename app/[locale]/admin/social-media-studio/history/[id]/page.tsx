import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { client } from "@/sanity/lib/client";
import { HistoryImageRegenerator } from "@/components/social-media-studio/HistoryImageRegenerator";
import { HistoryVideoPublishSection } from "@/components/social-media-studio/HistoryVideoPublishSection";
import { EditablePostTitle } from "@/components/social-media-studio/EditablePostTitle";
import { EditableCopies } from "@/components/social-media-studio/EditableCopies";
import { EditableVideoScript } from "@/components/social-media-studio/EditableVideoScript";
import type { SocialPostCopy, VideoStoryboard } from "@/lib/social-media-studio/types";

const DETAIL_QUERY = `*[_type == "socialPost" && _id == $id][0] {
  _id,
  sourceType,
  sourceTitle,
  sourceCategory,
  sourceLocale,
  sourceUrl,
  sourceImageUrl,
  status,
  tags,
  createdAt,
  updatedAt,
  publishedPlatforms,
  generatedCopies,
  squareImageUrl,
  verticalImageUrl,
  imageHeadline,
  videoScript,
  videoUrl,
  videoImages,
  videoStoryboard
}`;

type GeneratedCopy = Partial<SocialPostCopy> & { platform: string; locale: string };

interface VideoScript {
  duration?: number;
  hookScript?: string;
  fullScript?: string;
  onScreenText?: string[];
  brollSuggestions?: string[];
  voiceoverTips?: string;
  suggestedCaption?: string;
}

interface SocialPostDetail {
  _id: string;
  sourceType?: string;
  sourceTitle?: string;
  sourceCategory?: string;
  sourceLocale?: string;
  sourceUrl?: string;
  sourceImageUrl?: string;
  status?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  publishedPlatforms?: string[];
  generatedCopies?: GeneratedCopy[];
  squareImageUrl?: string;
  verticalImageUrl?: string;
  imageHeadline?: string;
  videoScript?: VideoScript;
  videoUrl?: string;
  videoImages?: { url?: string; concept?: string; createdAt?: string }[];
  videoStoryboard?: {
    voiceLanguage?: string;
    durationSeconds?: number;
    category?: string;
    presenter?: boolean;
    presenterPlacement?: string;
    scenes?: { narration?: string; onScreenText?: string; imageConcept?: string; imageUrl?: string }[];
  };
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook:        "Facebook",
  instagram:       "Instagram",
  threads:         "Threads",
  google_business: "Google Business",
  tiktok:          "TikTok",
  youtube:         "YouTube",
};

const PLATFORM_ICONS: Record<string, string> = {
  facebook:        "🔵",
  instagram:       "📷",
  threads:         "🧵",
  google_business: "🔍",
  tiktok:          "🎵",
  youtube:         "▶️",
};

export default async function SocialPostDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const post: SocialPostDetail | null = await client.fetch(DETAIL_QUERY, { id });
  if (!post) notFound();

  // Determine the post's content locale. Prefer the saved sourceLocale field; for older
  // posts that predate that field, infer from sourceUrl (e.g. /es/blog/... → "es").
  const postLocale: "en" | "es" =
    (post.sourceLocale === "es" || post.sourceUrl?.includes("/es/")) ? "es" : "en";

  const allCopies = post.generatedCopies ?? [];
  // Only show / use copies that match the source locale
  const localeCopies = allCopies.filter((c) => c.locale === postLocale);
  const publishedSet = new Set(post.publishedPlatforms ?? []);

  // Restore the active video storyboard (the image set used to render the Short).
  const initialStoryboard: VideoStoryboard | undefined = post.videoStoryboard?.scenes?.length
    ? {
        voiceLanguage:   post.videoStoryboard.voiceLanguage === "es" ? "es" : "en",
        durationSeconds: post.videoStoryboard.durationSeconds === 60 ? 60 : 30,
        category:        post.videoStoryboard.category,
        presenter:       post.videoStoryboard.presenter ?? false,
        presenterPlacement: post.videoStoryboard.presenterPlacement === "bottom-left" ? "bottom-left" : "bottom-right",
        scenes: post.videoStoryboard.scenes.map((s) => ({
          narration:    s.narration ?? "",
          onScreenText: s.onScreenText ?? "",
          imageConcept: s.imageConcept ?? "",
          imageUrl:     s.imageUrl ?? "",
        })),
      }
    : undefined;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href="/en/admin/social-media-studio/history" className="hover:text-foreground transition-colors">
          ← History
        </a>
        <span>/</span>
        <span className="text-foreground truncate max-w-xs">{post.sourceTitle ?? "Untitled"}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <EditablePostTitle postId={post._id} initialTitle={post.sourceTitle ?? "Untitled"} />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {post.sourceType && (
              <span className="text-xs text-muted-foreground capitalize">
                {post.sourceType.replace("_", " ")}
              </span>
            )}
            {post.sourceCategory && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">
                {post.sourceCategory}
              </span>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                post.status === "published"
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {post.status ?? "draft"}
            </span>
            {post.createdAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(post.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Creative Images — with AI regeneration */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Creative Images</h2>
        <HistoryImageRegenerator
          postId={post._id}
          initialHeadline={post.imageHeadline ?? post.sourceTitle ?? ""}
          initialSquareUrl={post.squareImageUrl ?? ""}
          initialVerticalUrl={post.verticalImageUrl ?? ""}
          sourceTitle={post.sourceTitle}
          sourceCategory={post.sourceCategory}
          sourceLocale={post.sourceLocale}
          sourceImageUrl={post.sourceImageUrl}
        />
      </section>

      {/* Generated Copies — editable, filtered to source locale only */}
      {localeCopies.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Generated Copy</h2>
          <EditableCopies postId={post._id} locale={postLocale} initialCopies={localeCopies as SocialPostCopy[]} />
        </section>
      )}

      {/* Video Script — editable */}
      {post.videoScript && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Video Script</h2>
          <EditableVideoScript
            postId={post._id}
            initial={{
              duration:         post.videoScript.duration,
              hookScript:       post.videoScript.hookScript,
              fullScript:       post.videoScript.fullScript,
              suggestedCaption: post.videoScript.suggestedCaption,
            }}
          />
        </section>
      )}

      {/* Published Platforms */}
      {publishedSet.size > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Published On</h2>
          <div className="flex flex-wrap gap-2">
            {[...publishedSet].map((platform) => (
              <span
                key={platform}
                className="flex items-center gap-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1 rounded-full"
              >
                <span>{PLATFORM_ICONS[platform] ?? "📣"}</span>
                {PLATFORM_LABELS[platform] ?? platform}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* AI Video + Publish to Social (shared state: a finished render auto-fills YouTube) */}
      <HistoryVideoPublishSection
        postId={post._id}
        sourceCategory={post.sourceCategory}
        sourceLocale={postLocale}
        videoScript={post.videoScript}
        squareImageUrl={post.squareImageUrl}
        verticalImageUrl={post.verticalImageUrl}
        initialVideoUrl={post.videoUrl}
        initialStoryboard={initialStoryboard}
        copies={localeCopies as SocialPostCopy[]}
        publishLocale={postLocale}
        publishedPlatforms={post.publishedPlatforms ?? []}
      />
    </div>
  );
}
