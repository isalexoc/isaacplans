"use client";

import { useState } from "react";
import { PublishToSocialSection } from "@/components/social-publishing/PublishToSocialSection";
import { HistoryVideoGenerator, type SanityVideoScript } from "./HistoryVideoGenerator";
import type { SocialPostCopy, SocialLocale, VideoStoryboard } from "@/lib/social-media-studio/types";

interface Props {
  postId: string;
  sourceCategory?: string;
  sourceLocale: SocialLocale;
  videoScript?: SanityVideoScript;
  squareImageUrl?: string;
  verticalImageUrl?: string;
  initialVideoUrl?: string;
  initialStoryboard?: VideoStoryboard;
  copies: SocialPostCopy[];
  publishLocale: SocialLocale;
  publishedPlatforms: string[];
}

/**
 * Client wrapper for the history detail page. Holds the generated video URL so that
 * finishing a render live auto-fills the YouTube field in the publish section below —
 * without requiring a page reload.
 */
export function HistoryVideoPublishSection(props: Props) {
  const [videoUrl, setVideoUrl] = useState<string>(props.initialVideoUrl ?? "");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">AI Video</h2>
        <HistoryVideoGenerator
          postId={props.postId}
          sourceCategory={props.sourceCategory}
          sourceLocale={props.sourceLocale}
          videoScript={props.videoScript}
          initialVideoUrl={props.initialVideoUrl}
          initialStoryboard={props.initialStoryboard}
          onVideoReady={setVideoUrl}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Publish to Social</h2>
        <PublishToSocialSection
          sanityPostId={props.postId}
          copies={props.copies}
          squareImageUrl={props.squareImageUrl}
          verticalImageUrl={props.verticalImageUrl}
          locale={props.publishLocale}
          publishedPlatforms={props.publishedPlatforms}
          initialYoutubeVideoUrl={videoUrl || undefined}
        />
      </section>
    </div>
  );
}
