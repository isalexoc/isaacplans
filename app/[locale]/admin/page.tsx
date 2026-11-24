import { redirect } from "next/navigation";
import { getStaffAccess, LEGAL_SHIELD_HOME } from "@/lib/auth/access";
import type { Metadata } from "next";
import {
  FileText,
  FileDown,
  Sparkles,
  History,
  CalendarDays,
  Link2,
  LayoutDashboard,
  ScanLine,
  ScrollText,
  Sticker,
  Package,
  ClipboardList,
  Presentation,
  Database,
  IdCard,
  Mailbox,
  PhoneCall,
  BarChart3,
  HeartPulse,
  Handshake,
  Shield,
  Image as ImageIcon,
  Timer,
  Smile,
  Banknote,
  Umbrella,
  Globe,
  MonitorPlay,
  AudioLines,
  MessageSquare,
  PieChart,
  Bot,
  Scale,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BlogUserAuth } from "@/components/blog-user-auth";

export const metadata: Metadata = {
  title: "Admin Dashboard | Isaac Plans",
  description: "Internal tools for content creation and social media management.",
  robots: { index: false, follow: false },
};

type ToolCard = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** The card's link text (default "Open →"). */
  cta?: string;
};

const CONTENT_TOOLS: ToolCard[] = [
  {
    title: "Blog Generator",
    description: "Turn a YouTube video into a bilingual blog post with AI.",
    href: "/en/admin/blog-generator",
    icon: FileText,
  },
  {
    title: "Lead Magnet Generator",
    description: "Create a branded consumer guide PDF from any topic.",
    href: "/en/admin/lead-magnet-generator",
    icon: FileDown,
  },
  {
    title: "Script Generator",
    description: "Generate bilingual sales presentation scripts and publish them to the library.",
    href: "/en/admin/script-generator",
    icon: ScrollText,
  },
  {
    title: "Illustration Studio",
    description:
      "Turn any carrier's IUL illustration into National Life's two-page \"My Planned Life Insurance Offers\" summary.",
    href: "/en/admin/illustration-studio",
    icon: PieChart,
  },
];

const OPERATIONS_TOOLS: ToolCard[] = [
  {
    title: "Held Website Leads",
    description:
      "Website leads Lead Guard kept out of the CRM (no form token, invalid phone, bursts). Release the real ones; bots never reach this list.",
    href: "/es/admin/lead-holds",
    icon: Shield,
  },
  {
    title: "Telegram Leads",
    description:
      "Review Empiregrowth IUL leads that arrived over Telegram and couldn't be read automatically.",
    href: "/en/admin/telegram-leads",
    icon: MessageSquare,
  },
  {
    title: "Lead Backup",
    description:
      "Manually process a Senior Life lead from a screenshot when the confirmation email didn't arrive.",
    href: "/en/admin/lead-backup",
    icon: ScanLine,
  },
  {
    title: "Agent Licenses",
    description: "Upload and manage license images, stored privately in Cloudinary.",
    href: "/en/admin/agent-licenses",
    icon: IdCard,
  },
  {
    title: "Page Media",
    description:
      "Swap the hero and social-share image on any line-of-business page — main, apply, or ads — or use a video instead of a photo.",
    href: "/en/admin/hero",
    icon: ImageIcon,
  },
  {
    title: "Referral Partners",
    description:
      "Manage referral partners, their co-branded landing pages, and the commissions you owe them.",
    href: "/en/admin/referral-partners",
    icon: Handshake,
  },
];

/**
 * One card per line of business's agent intake dashboard. Lifted out of OPERATIONS_TOOLS when the
 * count went from three to eight — at that size they were crowding out everything else.
 */
const INTAKE_TOOLS: ToolCard[] = [
  {
    title: "ACA Intake",
    description:
      "Send a secure health coverage form, then review household details and uploaded documents.",
    href: "/en/aca/intake",
    icon: HeartPulse,
  },
  {
    title: "Short Term Medical Intake",
    description: "Send a secure short term medical application and review what comes back.",
    href: "/en/short-term-medical/intake",
    icon: Timer,
  },
  {
    title: "Dental & Vision Intake",
    description: "Send a secure dental and vision application and review what comes back.",
    href: "/en/dental-vision/intake",
    icon: Smile,
  },
  {
    title: "Hospital Indemnity Intake",
    description: "Send a secure hospital indemnity application and review what comes back.",
    href: "/en/hospital-indemnity/intake",
    icon: Banknote,
  },
  {
    title: "IUL Intake",
    description: "Manage IUL application intakes and review submitted client applications.",
    href: "/en/iul/intake",
    icon: ClipboardList,
  },
  {
    title: "Life Insurance Intake",
    description:
      "Send a secure life application, then review health answers and named beneficiaries.",
    href: "/en/life-insurance/intake",
    icon: Umbrella,
  },
  {
    title: "Health Alternative Intake",
    description:
      "Send a secure application for clients ACA can't cover — no SSN or immigration status needed.",
    href: "/en/health-alternative/intake",
    icon: Globe,
  },
  {
    title: "Final Expense Intake",
    description: "Send a secure client intake link, then review submitted final expense applications.",
    href: "/en/final-expense/intake",
    icon: Shield,
  },
];

/** Isaac's dad's LegalShield sales (the only section the legal_shield role sees). */
const LEGAL_SHIELD_TOOLS: ToolCard[] = [
  {
    title: "Legal Shield",
    description:
      "Ysmael's LegalShield clients: start an application, present the plan over CrankWheel, review what came back.",
    href: LEGAL_SHIELD_HOME,
    icon: Scale,
  },
];

/** The same card, in Spanish, for Ysmael. */
const LEGAL_SHIELD_TOOLS_ES: ToolCard[] = [
  {
    title: "Solicitudes de clientes",
    description:
      "Cree la solicitud de un cliente, preséntele el plan por CrankWheel y revise lo que envió.",
    href: LEGAL_SHIELD_HOME,
    icon: Scale,
    cta: "Abrir →",
  },
];

const CALL_CENTER_TOOLS: ToolCard[] = [
  {
    title: "Start a Meeting",
    description:
      "Share your screen with any CRM contact. Replaces the CrankWheel button that LeadConnector hides.",
    href: "/en/admin/meet",
    icon: MonitorPlay,
  },
  {
    title: "Callback Priority",
    description: "Contacts with an open follow-up loop, sorted by soonest promised callback.",
    href: "/en/admin/call-dashboard",
    icon: PhoneCall,
  },
  {
    title: "Call Study",
    description:
      "Turn a recorded call into a readable dialogue with the speakers named, then mine it for script material.",
    href: "/en/admin/call-study",
    icon: AudioLines,
  },
  {
    title: "Call Metrics",
    description: "Contact rate, disposition mix, and line-of-business breakdown for a date range.",
    href: "/en/admin/call-metrics",
    icon: BarChart3,
  },
  {
    title: "Asistente de Citas (IA)",
    description: "Bandeja de aprobación, leads y ajustes del asistente que responde y agenda.",
    href: "/en/admin/ai-setter",
    icon: Bot,
  },
];

const CONTENT_CMS_TOOLS: ToolCard[] = [
  {
    title: "Presentations",
    description: "Open the sales presentation scripts library by line of business.",
    href: "/en/presentations",
    icon: Presentation,
  },
  {
    title: "Sanity Studio (CMS)",
    description: "Edit blog posts, presentation scripts, and licensed states.",
    href: "/studio",
    icon: Database,
  },
];

const FINAL_EXPENSE_TOOLS: ToolCard[] = [
  {
    title: "Sale Sticker",
    description:
      "Create a WhatsApp celebration sticker to announce a closed final expense sale.",
    href: "/en/final-expense/sale-sticker",
    icon: Sticker,
  },
  {
    title: "Leave-Behind Package",
    description:
      "Build a branded final expense quote package to share or leave behind with clients.",
    href: "/en/final-expense/leave-behind",
    icon: Package,
  },
  {
    title: "Mailing Labels",
    description:
      "Print name-and-address labels for mailed folders, plus USPS Priority Mail FROM/TO labels.",
    href: "/en/admin/mailing-labels",
    icon: Mailbox,
  },
];

const SOCIAL_TOOLS: ToolCard[] = [
  {
    title: "Social Media Studio",
    description: "Generate copy, images, and a video script from any content.",
    href: "/en/admin/social-media-studio",
    icon: Sparkles,
  },
  {
    title: "Content History",
    description: "Browse all previously generated social media packages.",
    href: "/en/admin/social-media-studio/history",
    icon: History,
  },
  {
    title: "Publishing Calendar",
    description: "View and manage scheduled posts across platforms.",
    href: "/en/admin/social-publishing/calendar",
    icon: CalendarDays,
  },
  {
    title: "Platform Connections",
    description: "Connect and manage OAuth credentials for each social platform.",
    href: "/en/admin/social-publishing/connections",
    icon: Link2,
  },
];

function ToolCardItem({ tool }: { tool: ToolCard }) {
  const Icon = tool.icon;
  return (
    <a href={tool.href} className="group block focus:outline-none">
      <Card className="h-full transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader className="pb-3">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-base">{tool.title}</CardTitle>
          <CardDescription>{tool.description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <span className="text-sm font-medium text-primary group-hover:underline">
            {tool.cta ?? "Open →"}
          </span>
        </CardContent>
      </Card>
    </a>
  );
}

export default async function AdminDashboardPage() {
  // Middleware already admits only staff here; the page still decides what each role may see,
  // because the legal_shield role reaches this root (and nothing else under /admin).
  const access = await getStaffAccess();
  if (!access.userId) redirect("/sign-in");
  if (access.role === "legal_shield") return <LegalShieldHome />;
  if (!access.isAdmin) redirect("/es/unauthorized");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Internal tools for content creation and publishing
            </p>
          </div>
        </div>
        <BlogUserAuth />
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Content Creation
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONTENT_TOOLS.map((tool) => (
              <ToolCardItem key={tool.href} tool={tool} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Operations
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OPERATIONS_TOOLS.map((tool) => (
              <ToolCardItem key={tool.href} tool={tool} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Client Intake
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INTAKE_TOOLS.map((tool) => (
              <ToolCardItem key={tool.href} tool={tool} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Legal Shield
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LEGAL_SHIELD_TOOLS.map((tool) => (
              <ToolCardItem key={tool.href} tool={tool} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Call Center
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CALL_CENTER_TOOLS.map((tool) => (
              <ToolCardItem key={tool.href} tool={tool} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Final Expense
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FINAL_EXPENSE_TOOLS.map((tool) => (
              <ToolCardItem key={tool.href} tool={tool} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Social Media
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SOCIAL_TOOLS.map((tool) => (
              <ToolCardItem key={tool.href} tool={tool} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Content &amp; CMS
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONTENT_CMS_TOOLS.map((tool) => (
              <ToolCardItem key={tool.href} tool={tool} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Ysmael's whole dashboard: one section, in Spanish, nothing else of Isaac's. */
function LegalShieldHome() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Legal Shield</h1>
            <p className="text-sm text-muted-foreground">Sus clientes, sus solicitudes y su presentación</p>
          </div>
        </div>
        <BlogUserAuth />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LEGAL_SHIELD_TOOLS_ES.map((tool) => (
          <ToolCardItem key={tool.href} tool={tool} />
        ))}
      </div>
    </div>
  );
}
