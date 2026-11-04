import "../admin/admin.css";
export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen bg-[var(--background)] text-[var(--foreground)]"
      style={{ padding: 24 }}
    >
      {children}
    </div>
  );
}
