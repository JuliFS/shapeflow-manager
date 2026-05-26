import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { useCompany } from "@/contexts/CompanyContext";
import { Building2 } from "lucide-react";

function CompanyGuard({ children }: { children: ReactNode }) {
  const { loading, companies, currentCompanyId } = useCompany();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="animate-pulse text-muted-foreground text-sm">Carregando empresa...</div>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
        <Building2 className="h-10 w-10 text-muted-foreground" />
        <div className="text-lg font-semibold">Nenhuma empresa encontrada</div>
        <p className="text-sm text-muted-foreground max-w-sm">
          Crie uma empresa para começar. Use o botão <strong>+</strong> no topo da tela.
        </p>
      </div>
    );
  }

  if (!currentCompanyId) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-sm text-muted-foreground">Selecione uma empresa no topo da tela.</div>
      </div>
    );
  }

  return <>{children}</>;
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 p-6 overflow-auto">
            <CompanyGuard>{children}</CompanyGuard>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
