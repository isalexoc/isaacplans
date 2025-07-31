import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Lightweight wrappers around Next.js' navigation
// APIs that consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

export type AppHref =
  | "/" // home
  | "/contact" // internal path (en)
  | "/aca"
  | "/dental-vision"
  | "/hospital-indemnity"
  | "/about";
