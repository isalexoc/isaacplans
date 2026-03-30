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
  | "/aca/calendar"
  | "/dental-vision"
  | "/dental-vision/calendar"
  | "/hospital-indemnity"
  | "/hospital-indemnity/calendar"
  | "/about"
  | "/about#missionVision"
  | "/about#whyChooseUs"
  | "/about#meetFounder"
  | "/about#contactSupport"
  | "/iul"
  | "/iul/calendar"
  | "/iul/presentation"
  | "/final-expense/presentation"
  | "/final-expense/calendar"
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
  | "/newsletter"
  | "/carriers"
  | "/carriers/uhone"
  | "/carriers/uhone/shortterm"
  | "/carriers/pivot/shortterm"
  | "/carriers/manhattan"
  | "/carriers/manhattan/[product]"
  | "/carriers/manhattan/shortterm"
  | "/carriers/allstate"
  | "/carriers/allstate/shortterm"
  | "/carriers/allstate/seniors/[product]"
  | "/carriers/allstate/individual/[product]"
  | "/carriers/allstate/cancer-only";
