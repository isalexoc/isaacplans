// components/form-skeleton.tsx
"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function FormSkeleton() {
  return (
    <div className="flex min-h-full w-full items-center justify-center p-6">
      <div className="mx-auto w-full max-w-[480px] space-y-5">
        {/* First Name */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>

        {/* Last Name */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>

        {/* Submit button */}
        <div className="pt-2">
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>

        {/* Terms / checkboxes */}
        <div className="space-y-3 pt-2">
          <div className="flex items-start gap-3">
            <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-full max-w-[90%]" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
