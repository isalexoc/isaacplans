import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
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
];

const OPERATIONS_TOOLS: ToolCard[] = [
  {
    title: "Lead Backup",
    description:
      "Manually process a Senior Life lead from a screenshot when the confirmation email didn't arrive.",
    href: "/en/admin/lead-backup",
    icon: ScanLine,
  },
  {
    title: "IUL Intake",
    description: "Manage IUL application intakes and review submitted client applications.",
    href: "/en/iul/intake",
    icon: ClipboardList,
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
            Open →
          </span>
        </CardContent>
      </Card>
    </a>
  );
}

export default async function AdminDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

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
