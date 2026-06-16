import AdminBackNav from "@/components/admin/AdminBackNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminBackNav />
      {children}
    </>
  );
}
