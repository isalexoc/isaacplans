/**
 * What both page frames share (components/site-shell/main-shell.tsx, product-shell.tsx): the API
 * app/[locale]/layout.tsx calls, so the build can swap one frame for the other (see
 * active-shell.ts), and the one inline script both draw. Nothing of Isaac's lives here.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { AppSurface } from "@/lib/tenancy/surface";

export type SiteShellProps = {
  locale: string;
  /** The layout's `next/font` class (Inter), declared once in app/[locale]/layout.tsx. */
  fontClassName: string;
  children: ReactNode;
};

/** Every frame exports exactly these, under these names. */
export type SiteShellComponent = (props: SiteShellProps) => Promise<ReactNode>;
export type ShellMetadata = () => Promise<Metadata>;
export type ShellSurface = AppSurface;

/** Strip extension-injected attrs (e.g. fdprocessedid) — must run synchronously on mutation so React hydration does not see mismatched attrs */
export const STRIP_EXTENSION_ATTRS = `(function(){function strip(){document.querySelectorAll("[fdprocessedid]").forEach(function(el){el.removeAttribute("fdprocessedid");});}function onMut(){strip();}strip();document.addEventListener("DOMContentLoaded",strip);if(typeof MutationObserver!=="undefined"){try{new MutationObserver(onMut).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["fdprocessedid"]});}catch(e){}}})();`;
