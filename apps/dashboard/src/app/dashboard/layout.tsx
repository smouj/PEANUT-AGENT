import { requireAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const user = await requireAuth();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar userEmail={user.email} userRole={user.role} />
      <main className="flex-1 ml-64 overflow-auto">
        {children}
      </main>
    </div>
  );
}
