import { defineField, defineType } from "sanity";
import { ShareIcon } from "@sanity/icons";

export const socialPostType = defineType({
  name: "socialPost",
  title: "Social Media Post",
  type: "document",
  icon: ShareIcon,
  groups: [
    { name: "source",  title: "Source Content" },
    { name: "copies",  title: "Generated Copy" },
    { name: "images",  title: "Creative Images" },
    { name: "video",   title: "Video Script" },
    { name: "meta",    title: "Status & Tags" },
  ],
  fields: [
    // ─── SOURCE ───────────────────────────────────────────────────────────────
    defineField({
      name: "sourceType",
      title: "Source Type",
      type: "string",
      group: "source",
      options: {
        list: [
          { title: "Blog Post",    value: "blog_post" },
          { title: "Lead Magnet",  value: "lead_magnet" },
          { title: "Direct Topic", value: "direct_topic" },
        ],
      },
      validation: (R) => R.required(),
    }),
    defineField({
      name: "sourceId",
      title: "Source Document ID",
      type: "string",
      group: "source",
      description: "Sanity _id of the source document (blog post or lead magnet)",
      readOnly: true,
    }),
    defineField({
      name: "sourceTitle",
      title: "Source Title",
      type: "string",
      group: "source",
      validation: (R) => R.required(),
    }),
    defineField({
      name: "sourceSlug",
      title: "Source Slug",
      type: "string",
      group: "source",
      readOnly: true,
    }),
    defineField({
      name: "sourceLocale",
      title: "Source Locale",
      type: "string",
      group: "source",
      options: { list: [{ title: "English", value: "en" }, { title: "Spanish", value: "es" }] },
      readOnly: true,
    }),
    defineField({
      name: "sourceUrl",
      title: "Source Public URL",
      type: "url",
      group: "source",
      description: "Public URL of the source content — used in post CTAs",
    }),
    defineField({
      name: "sourceImageUrl",
      title: "Source Image URL",
      type: "url",
      group: "source",
      description: "Original image URL used as base for creative generation",
      readOnly: true,
    }),
    defineField({
      name: "sourceCategory",
      title: "Insurance Category",
      type: "string",
      group: "source",
      readOnly: true,
    }),

    // ─── GENERATED COPIES ─────────────────────────────────────────────────────
    {
      name: "generatedCopies",
      title: "Generated Copies",
      type: "array",
      group: "copies",
      of: [
        {
          type: "object",
          fields: [
            {
              name: "platform",
              title: "Platform",
              type: "string",
              options: { list: ["facebook", "instagram", "tiktok", "threads", "google_business", "youtube"] },
            },
            {
              name: "locale",
              title: "Locale",
              type: "string",
              options: { list: ["en", "es"] },
            },
            { name: "hook",           title: "Hook",            type: "text", rows: 2 },
            { name: "body",           title: "Body",            type: "text", rows: 4 },
            { name: "cta",            title: "CTA",             type: "text", rows: 2 },
            {
              name: "hashtags",
              title: "Hashtags",
              type: "array",
              of: [{ type: "string" }],
            },
            {
              name: "fullPost",
              title: "Full Post",
              type: "text",
              rows: 8,
              description: "Assembled post ready to paste into Metricool",
            },
            { name: "characterCount", title: "Character Count", type: "number" },
          ],
          preview: {
            select: { platform: "platform", locale: "locale" },
            prepare({ platform, locale }: { platform?: string; locale?: string }) {
              return { title: `${platform ?? "unknown"} / ${locale ?? "unknown"}` };
            },
          },
        },
      ],
    },

    // ─── IMAGES ───────────────────────────────────────────────────────────────
    defineField({
      name: "squareImageUrl",
      title: "Square Image (1:1)",
      type: "url",
      group: "images",
      description: "Cloudinary URL — 1080×1080 branded image",
    }),
    defineField({
      name: "verticalImageUrl",
      title: "Vertical Image (9:16)",
      type: "url",
      group: "images",
      description: "Cloudinary URL — 1080×1920 branded image",
    }),
    defineField({
      name: "imageHeadline",
      title: "Image Headline",
      type: "string",
      group: "images",
      description: "Text overlaid on both images",
    }),

    // ─── VIDEO SCRIPT ─────────────────────────────────────────────────────────
    {
      name: "videoScript",
      title: "Video Script",
      type: "object",
      group: "video",
      fields: [
        { name: "duration",         title: "Duration (seconds)", type: "number",  description: "30 or 60 seconds" },
        { name: "hookScript",       title: "Hook Script",        type: "text",    rows: 3 },
        { name: "fullScript",       title: "Full Script",        type: "text",    rows: 12 },
        {
          name: "onScreenText",
          title: "On-Screen Text",
          type: "array",
          of: [{ type: "string" }],
        },
        {
          name: "brollSuggestions",
          title: "B-Roll Suggestions",
          type: "array",
          of: [{ type: "string" }],
        },
        { name: "voiceoverTips",    title: "Voiceover Tips",    type: "text",    rows: 3 },
        { name: "suggestedCaption", title: "Suggested Caption", type: "text",    rows: 3 },
      ],
    },
    defineField({
      name: "videoUrl",
      title: "Generated Video (9:16 mp4)",
      type: "url",
      group: "video",
      description: "AI-generated YouTube Short — Cloudinary mp4 URL used for publishing",
    }),
    {
      name: "videoImages",
      title: "Generated Video Images (portrait)",
      type: "array",
      group: "video",
      description: "Portrait 9:16 images generated for videos — stacks with each generation",
      of: [
        {
          type: "object",
          fields: [
            { name: "url",       title: "Image URL", type: "url" },
            { name: "concept",   title: "Concept",   type: "text", rows: 2 },
            { name: "createdAt", title: "Created At", type: "datetime" },
          ],
          preview: {
            select: { subtitle: "concept", media: "url" },
            prepare({ subtitle }: { subtitle?: string }) {
              return { title: "Video image", subtitle: subtitle ?? "" };
            },
          },
        },
      ],
    },
    {
      name: "videoStoryboard",
      title: "Active Video Storyboard",
      type: "object",
      group: "video",
      description: "The scene set currently used to render the video (narration + chosen images)",
      fields: [
        { name: "voiceLanguage",   title: "Voice Language",    type: "string" },
        { name: "durationSeconds", title: "Duration (s)",      type: "number" },
        { name: "category",        title: "Category",          type: "string" },
        {
          name: "scenes",
          title: "Scenes",
          type: "array",
          of: [
            {
              type: "object",
              fields: [
                { name: "narration",    title: "Narration",      type: "text", rows: 2 },
                { name: "onScreenText", title: "On-Screen Text", type: "string" },
                { name: "imageConcept", title: "Image Concept",  type: "text", rows: 2 },
                { name: "imageUrl",     title: "Image URL",      type: "url" },
              ],
              preview: { select: { title: "narration", media: "imageUrl" } },
            },
          ],
        },
      ],
    },

    // ─── META ─────────────────────────────────────────────────────────────────
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      group: "meta",
      options: { list: ["draft", "published", "archived"] },
      initialValue: "draft",
      validation: (R) => R.required(),
    }),
    {
      name: "tags",
      title: "Tags",
      type: "array",
      group: "meta",
      of: [{ type: "string" }],
    },
    {
      name: "publishedPlatforms",
      title: "Published Platforms",
      type: "array",
      group: "meta",
      of: [{ type: "string" }],
      description: "Platforms where this post has been successfully published (written by the publish pipeline)",
      readOnly: true,
    },
    defineField({
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      group: "meta",
      readOnly: true,
    }),
    defineField({
      name: "updatedAt",
      title: "Updated At",
      type: "datetime",
      group: "meta",
      readOnly: true,
    }),
  ],

  preview: {
    select: {
      title: "sourceTitle",
      subtitle: "sourceType",
    },
    prepare({ title, subtitle }: { title?: string; subtitle?: string }) {
      const typeLabel: Record<string, string> = {
        blog_post:    "Blog Post",
        lead_magnet:  "Lead Magnet",
        direct_topic: "Topic",
      };
      return {
        title: title ?? "Untitled Social Post",
        subtitle: subtitle ? (typeLabel[subtitle] ?? subtitle) : undefined,
      };
    },
  },

  orderings: [
    {
      title: "Created, Newest",
      name: "createdAtDesc",
      by: [{ field: "createdAt", direction: "desc" }],
    },
  ],
});
