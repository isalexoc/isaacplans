import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Lightweight wrappers around Next.js' navigation
// APIs that consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

export type AppHref =
  | "/" // home
  | "/contact" // internal path (en)
  | "/contact#contact-form" // contact form
  | "/aca"
  | "/dental-vision"
  | "/hospital-indemnity"
  | "/about"
  | "/about#missionVision"
  | "/about#whyChooseUs"
  | "/about#meetFounder"
  | "/about#contactSupport"
  | "/iul"
  | "/short-term-medical"
  | "/gastos-finales";
