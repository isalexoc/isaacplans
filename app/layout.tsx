// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Keep this minimal; your real layout lives in app/[locale]/layout.tsx
  return children;
}
