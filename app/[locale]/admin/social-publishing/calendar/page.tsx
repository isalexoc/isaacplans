"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SOCIAL_PLATFORM_LABELS,
  type SocialPlatform,
} from "@/lib/social-publishing/types";
import type { ScheduledPost } from "@/lib/social-publishing/types";

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-blue-100 text-blue-800",
  publishing: "bg-yellow-100 text-yellow-800",
  published:  "bg-green-100 text-green-800",
  failed:     "bg-red-100 text-red-800",
  cancelled:  "bg-gray-100 text-gray-600",
};

const PLATFORM_EMOJI: Record<SocialPlatform, string> = {
  facebook:        "🔵",
  instagram:       "📷",
  threads:         "🧵",
  google_business: "🔍",
  tiktok:          "🎵",
  youtube:         "▶️",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function SocialCalendarPage() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    const from = new Date(y, m, 1).toISOString();
    const to   = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
    try {
      const res = await fetch(`/api/admin/social-publishing/calendar?from=${from}&to=${to}`);
      const data = await res.json();
      if (data.success) setPosts(data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMonth(year, month); }, [year, month, loadMonth]);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow    = getFirstDayOfWeek(year, month);

  // Build a map: day → posts
  const dayMap = new Map<number, ScheduledPost[]>();
  for (const post of posts) {
    const d = new Date(post.scheduledFor);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(post);
    }
  }

  // Calendar grid cells
  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({ day: null });

  async function cancelPost(id: string) {
    if (!confirm("Cancel this scheduled post?")) return;
    await fetch(`/api/admin/social-publishing/schedule/${id}`, { method: "DELETE" });
    await loadMonth(year, month);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Publishing Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">Scheduled and published social posts.</p>
        </div>
        <div className="flex gap-3">
          <a href="/en/admin/social-publishing/connections" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Connections
          </a>
          <a href="/en/admin/social-media-studio" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Studio
          </a>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold min-w-40 text-center">
          {MONTH_NAMES[month]} {year}
        </h2>
        <Button variant="outline" size="sm" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 bg-muted/50">
          {DOW.map((d) => (
            <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-b">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const isToday = cell.day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dayPosts = cell.day ? (dayMap.get(cell.day) ?? []) : [];

            return (
              <div
                key={i}
                className={cn(
                  "min-h-24 p-1.5 border-b border-r text-sm",
                  !cell.day && "bg-muted/20",
                  i % 7 === 6 && "border-r-0", // last column
                )}
              >
                {cell.day && (
                  <>
                    <p className={cn(
                      "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                      isToday ? "bg-blue-600 text-white" : "text-muted-foreground"
                    )}>
                      {cell.day}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {dayPosts.map((post) => (
                        <button
                          key={post.id}
                          onClick={() => {
                            if (post.status === "pending") cancelPost(post.id);
                          }}
                          title={`${SOCIAL_PLATFORM_LABELS[post.platform]} — ${post.sanityPostTitle ?? post.sanityPostId} — ${post.status}${post.status === "pending" ? "\nClick to cancel" : ""}`}
                          className={cn(
                            "w-full text-left text-xs px-1 py-0.5 rounded truncate",
                            STATUS_COLORS[post.status] ?? "bg-gray-100 text-gray-800",
                            post.status === "pending" && "hover:opacity-75 cursor-pointer"
                          )}
                        >
                          {PLATFORM_EMOJI[post.platform]} {post.sanityPostTitle?.slice(0, 20) ?? "Post"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <span key={status} className={cn("px-2 py-0.5 rounded-full", cls)}>
            {status}
          </span>
        ))}
        <span className="text-muted-foreground">· Click pending posts to cancel</span>
      </div>
    </div>
  );
}
