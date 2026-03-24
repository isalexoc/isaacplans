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
  | "/contact/calendar" // contact calendar
  | "/aca"
  | "/dental-vision"
  | "/hospital-indemnity"
  | "/about"
  | "/about#missionVision"
  | "/about#whyChooseUs"
  | "/about#meetFounder"
  | "/about#contactSupport"
  | "/iul"
  | "/iul/presentation"
  | "/final-expense/presentation"
  | "/final-expense/qualification"
  | "/final-expense/referrals"
  | "/final-expense/leave-behind"
  | "/short-term-medical"
  | "/short-term-medical/calendar"
  | "/gastos-finales"
  | "/faq"
  | "/testimonials"
  | "/glossary"
  | "/subsidy-calculator"
  | "/plan-comparison"
  | "/renewal-support"
  | "/consumer-guides"
  | "/blog"
  | "/newsletter";
