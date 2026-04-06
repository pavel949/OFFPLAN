import { AdminNav } from "./admin-nav";

export function AdminChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-root">
      <AdminNav />
      <main className="admin-main">{children}</main>
    </div>
  );
}
