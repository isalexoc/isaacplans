import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { client } from "@/sanity/lib/client";

const HISTORY_QUERY = `*[_type == "socialPost"] | order(createdAt desc) [0...50] {
  _id,
  sourceType,
  sourceTitle,
  sourceCategory,
  status,
  tags,
  createdAt,
  "platforms": generatedCopies[].platform,
  "locales": generatedCopies[].locale,
  publishedPlatforms,
  squareImageUrl,
}`;

interface SocialPostListItem {
  _id: string;
  sourceType?: string;
  sourceTitle?: string;
  sourceCategory?: string;
  status?: string;
  tags?: string[];
  createdAt?: string;
  platforms?: string[];
  locales?: string[];
  publishedPlatforms?: string[];
  squareImageUrl?: string;
}

export default async function SocialHistoryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const posts: SocialPostListItem[] = await client.fetch(HISTORY_QUERY);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Content History</h1>
          <p className="text-muted-foreground text-sm">{posts.length} packages generated</p>
        </div>
        <a
          href="/en/admin/social-media-studio"
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Generate New Post
        </a>
      </div>

      <div className="space-y-3">
        {posts.map((post) => {
          const uniquePlatforms = [...new Set(post.platforms ?? [])];
          const publishedSet = new Set(post.publishedPlatforms ?? []);
          return (
            <a
              key={post._id}
              href={`/en/admin/social-media-studio/history/${post._id}`}
              className="border border-border rounded-lg p-4 flex items-center gap-4 bg-card hover:bg-muted/50 transition-colors cursor-pointer"
            >
              {post.squareImageUrl ? (
                <img
                  src={`${post.squareImageUrl}?w=64&h=64&fit=crop`}
                  alt=""
                  className="w-16 h-16 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded bg-muted flex-shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className="font-medium text-card-foreground truncate">
                  {post.sourceTitle ?? "Untitled"}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground capitalize">
                    {post.sourceType?.replace("_", " ")}
                  </span>
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
                </div>
                {post.createdAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(post.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {uniquePlatforms.map((p) => (
                  <span
                    key={p}
                    className={`text-xs px-2 py-0.5 rounded capitalize ${
                      publishedSet.has(p)
                        ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-medium"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.replace("_", " ")}
                  </span>
                ))}
              </div>

              <span className="text-sm text-blue-500 flex-shrink-0">View →</span>
            </a>
          );
        })}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No posts generated yet.</p>
          <a
            href="/en/admin/social-media-studio"
            className="text-blue-500 hover:underline mt-2 inline-block"
          >
            Generate your first post →
          </a>
        </div>
      )}
    </div>
  );
}
