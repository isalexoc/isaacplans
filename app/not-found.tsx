// app/not-found.tsx
"use client";

import Error from "next/error";

// Handles non-localized requests (e.g. paths not matched by your i18n middleware)
export default function NotFoundRoot() {
  return (
    <html lang="en">
      <body>
        <Error statusCode={404} />
      </body>
    </html>
  );
}
