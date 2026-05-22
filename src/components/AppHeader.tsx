import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Sun, Moon, LogOut, Building2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const planLabels: Record<string, string> = { free: "Free", pro: "Pro", studio: "Studio" };
const planColors: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/10 text-primary",
  studio: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();
  const { signOut, user } = useAuth();
  const { companies, currentCompanyId, currentCompany, setCurrentCompanyId, refetch } = useCompany();
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);

  const createCompany = async () => {
    const companyName = newCompanyName.trim();
    if (!companyName) { toast.error("Informe o nome da empresa."); return; }
    if (!user?.id) { toast.error("Você precisa estar logado para criar uma empresa."); return; }

    setCreatingCompany(true);
    try {
      const companyId = crypto.randomUUID();
      const { error: companyError } = await supabase.from("companies").insert({ id: companyId, name: companyName });
      if (companyError) throw companyError;

      const { error: linkError } = await supabase.from("user_companies").insert({ user_id: user.id, company_id: companyId, role: "owner" });
      if (linkError) throw linkError;

      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: user.id,
        company_id: companyId,
        company_name: companyName,
        owner_name: user.user_metadata?.full_name ?? "",
        company_email: user.email ?? "",
      });
      if (profileError) throw profileError;

      setCurrentCompanyId(companyId);
      await refetch();
      toast.success("Empresa criada com sucesso!");
      setNewCompanyOpen(false);
      setNewCompanyName("");
    } catch (err: any) {
      toast.error(`Erro ao criar empresa: ${err?.message ?? "tente novamente"}`);
    } finally {
      setCreatingCompany(false);
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="h-8 w-8" />
      </div>
      <div className="flex items-center gap-3">
        {/* Company switcher */}
        {companies.length > 0 && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={currentCompanyId ?? ""} onValueChange={setCurrentCompanyId}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentCompany && (
              <Badge variant="secondary" className={planColors[currentCompany.plan] ?? ""}>
                {planLabels[currentCompany.plan] ?? currentCompany.plan}
              </Badge>
            )}
          </div>
        )}

        {/* New company dialog */}
        <Dialog open={newCompanyOpen} onOpenChange={setNewCompanyOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Nova empresa">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Nova Empresa</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createCompany(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Empresa *</Label>
                <Input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} required placeholder="Nome da empresa" />
              </div>
              <Button type="submit" className="w-full" disabled={creatingCompany}>
                {creatingCompany ? "Criando..." : "Criar Empresa"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {user && (
          <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
