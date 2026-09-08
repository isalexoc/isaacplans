import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NewPresenterAd } from "@/components/social-media-studio/NewPresenterAd";

export default async function NewPresenterAdPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <a href="/en/admin/social-media-studio/history" className="transition-colors hover:text-foreground">
          ← History
        </a>
        <span>/</span>
        <span className="text-foreground">New presenter ad</span>
      </div>
      <NewPresenterAd />
    </div>
  );
}
