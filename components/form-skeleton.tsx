// components/form-skeleton.tsx
"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function FormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[650px] px-6 pt-8">
      <div className="space-y-5">
        {/* First Name */}
        <div>
          <Skeleton className="h-3 w-28 mb-2" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>

        {/* Last Name */}
        <div>
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>

        {/* Phone */}
        <div>
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>

        {/* Email */}
        <div>
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>

        {/* Submit button */}
        <div className="pt-1">
          <Skeleton className="h-11 w-full rounded-md" />
        </div>

        {/* Terms / checkboxes */}
        <div className="space-y-3 pt-2">
          <div className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
