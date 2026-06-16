import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { client } from "@/sanity/lib/client";
import { PublishToSocialSection } from "@/components/social-publishing/PublishToSocialSection";
import type { SocialPostCopy } from "@/lib/social-media-studio/types";

const DETAIL_QUERY = `*[_type == "socialPost" && _id == $id][0] {
  _id,
  sourceType,
  sourceTitle,
  sourceCategory,
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
  videoScript
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
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook:        "Facebook",
  instagram:       "Instagram",
  threads:         "Threads",
  google_business: "Google Business",
  tiktok:          "TikTok",
};

const PLATFORM_ICONS: Record<string, string> = {
  facebook:        "🔵",
  instagram:       "📷",
  threads:         "🧵",
  google_business: "🔍",
  tiktok:          "🎵",
};

export default async function SocialPostDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { locale, id } = await params;
  const post: SocialPostDetail | null = await client.fetch(DETAIL_QUERY, { id });
  if (!post) notFound();

  const uniquePlatforms = [...new Set((post.generatedCopies ?? []).map((c) => c.platform))];
  const publishedSet = new Set(post.publishedPlatforms ?? []);

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
          <h1 className="text-2xl font-bold text-foreground">{post.sourceTitle ?? "Untitled"}</h1>
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

      {/* Images */}
      {(post.squareImageUrl || post.verticalImageUrl) && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Creative Images</h2>
          {post.imageHeadline && (
            <p className="text-sm text-muted-foreground italic">"{post.imageHeadline}"</p>
          )}
          <div className="flex gap-4 flex-wrap">
            {post.squareImageUrl && (
              <div className="space-y-1">
                <img
                  src={post.squareImageUrl}
                  alt="Square 1:1"
                  className="w-40 h-40 rounded-lg object-cover border border-border"
                />
                <p className="text-xs text-muted-foreground text-center">Square (1:1)</p>
              </div>
            )}
            {post.verticalImageUrl && (
              <div className="space-y-1">
                <img
                  src={post.verticalImageUrl}
                  alt="Vertical 9:16"
                  className="w-24 h-40 rounded-lg object-cover border border-border"
                />
                <p className="text-xs text-muted-foreground text-center">Vertical (9:16)</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Generated Copies */}
      {uniquePlatforms.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Generated Copy</h2>
          {uniquePlatforms.map((platform) => {
            const copies = (post.generatedCopies ?? []).filter((c) => c.platform === platform);
            return (
              <div key={platform} className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
                  <span>{PLATFORM_ICONS[platform] ?? "📣"}</span>
                  <span className="font-medium text-sm">{PLATFORM_LABELS[platform] ?? platform}</span>
                  {publishedSet.has(platform) && (
                    <span className="ml-auto text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                      Published
                    </span>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {copies.map((copy) => (
                    <div key={copy.locale} className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {copy.locale === "en" ? "English" : "Spanish"}
                        </span>
                        {copy.characterCount && (
                          <span className="text-xs text-muted-foreground">· {copy.characterCount} chars</span>
                        )}
                      </div>
                      <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                        {copy.fullPost}
                      </pre>
                      {copy.hashtags && copy.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {copy.hashtags.map((tag) => (
                            <span key={tag} className="text-xs text-blue-600 dark:text-blue-400">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Video Script */}
      {post.videoScript && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Video Script</h2>
          <div className="border border-border rounded-lg divide-y divide-border">
            {post.videoScript.duration && (
              <div className="px-4 py-3 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</span>
                <span className="text-sm">{post.videoScript.duration}s</span>
              </div>
            )}
            {post.videoScript.hookScript && (
              <div className="p-4 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hook</p>
                <p className="text-sm whitespace-pre-wrap">{post.videoScript.hookScript}</p>
              </div>
            )}
            {post.videoScript.fullScript && (
              <div className="p-4 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Script</p>
                <pre className="text-sm whitespace-pre-wrap font-sans">{post.videoScript.fullScript}</pre>
              </div>
            )}
            {post.videoScript.onScreenText && post.videoScript.onScreenText.length > 0 && (
              <div className="p-4 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">On-Screen Text</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  {post.videoScript.onScreenText.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            {post.videoScript.suggestedCaption && (
              <div className="p-4 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suggested Caption</p>
                <p className="text-sm whitespace-pre-wrap">{post.videoScript.suggestedCaption}</p>
              </div>
            )}
          </div>
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

      {/* Publish to Social */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Publish to Social</h2>
        <PublishToSocialSection
          sanityPostId={post._id}
          copies={(post.generatedCopies ?? []) as SocialPostCopy[]}
          squareImageUrl={post.squareImageUrl}
          verticalImageUrl={post.verticalImageUrl}
          locale={locale}
          publishedPlatforms={post.publishedPlatforms ?? []}
        />
      </section>
    </div>
  );
}
