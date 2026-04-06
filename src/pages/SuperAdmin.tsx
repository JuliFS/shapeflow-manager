import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, Users, Shield } from "lucide-react";

const planColors: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/10 text-primary",
  studio: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export default function SuperAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: isSuperAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ["is_super_admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("super_admins")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["all_companies"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!isSuperAdmin,
  });

  const { data: allMemberships = [] } = useQuery({
    queryKey: ["all_memberships"],
    queryFn: async () => {
      const { data } = await supabase.from("user_companies").select("*");
      return data ?? [];
    },
    enabled: !!isSuperAdmin,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all_users_admin"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_all_users_for_admin");
      return (data ?? []) as { id: string; email: string; created_at: string }[];
    },
    enabled: !!isSuperAdmin,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all_profiles_admin"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, owner_name, company_id");
      return data ?? [];
    },
    enabled: !!isSuperAdmin,
  });

  const updatePlan = useMutation({
    mutationFn: async ({ companyId, plan }: { companyId: string; plan: string }) => {
      const { error } = await supabase.from("companies").update({ plan }).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_companies"] });
      toast.success("Plano atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: async ({ membershipId, role }: { membershipId: string; role: string }) => {
      const { error } = await supabase.from("user_companies").update({ role }).eq("id", membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_memberships"] });
      toast.success("Role atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateUserCompany = useMutation({
    mutationFn: async ({ membershipId, companyId }: { membershipId: string; companyId: string }) => {
      const { error } = await supabase.from("user_companies").update({ company_id: companyId }).eq("id", membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_memberships"] });
      toast.success("Empresa alterada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (checkingAdmin) {
    return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Verificando permissões...</div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground gap-4">
        <Shield className="h-12 w-12" />
        <p className="text-lg font-medium">Acesso restrito</p>
        <p className="text-sm">Você não tem permissão de super administrador.</p>
      </div>
    );
  }

  const getMemberCount = (companyId: string) =>
    allMemberships.filter((m: any) => m.company_id === companyId).length;

  const getCompanyName = (companyId: string) =>
    companies.find((c: any) => c.id === companyId)?.name ?? "—";

  // Build user rows by joining auth users + memberships
  const userRows = allUsers.map((u) => {
    const membership = allMemberships.find((m: any) => m.user_id === u.id);
    const profile = allProfiles.find((p: any) => p.user_id === u.id);
    return {
      ...u,
      membershipId: membership?.id ?? null,
      companyId: membership?.company_id ?? null,
      companyName: membership ? getCompanyName(membership.company_id) : "Sem empresa",
      role: membership?.role ?? "—",
      ownerName: profile?.owner_name ?? "",
    };
  });

  const uniqueUsers = new Set(allMemberships.map((m: any) => m.user_id)).size;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Admin do Sistema</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{companies.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Usuários</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{uniqueUsers}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Planos Pro/Studio</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{companies.filter((c: any) => c.plan !== "free").length}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="companies">
          <Card>
            <CardHeader><CardTitle className="text-base">Todas as Empresas</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Membros</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead>Alterar Plano</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{getMemberCount(c.id)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={planColors[c.plan] ?? ""}>
                          {c.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Select value={c.plan} onValueChange={(plan) => updatePlan.mutate({ companyId: c.id, plan })}>
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="studio">Studio</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader><CardTitle className="text-base">Todos os Usuários</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Alterar Role</TableHead>
                    <TableHead>Alterar Empresa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium text-xs">{u.email}</TableCell>
                      <TableCell className="text-sm">{u.ownerName || "—"}</TableCell>
                      <TableCell className="text-sm">{u.companyName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {u.membershipId ? (
                          <Select value={u.role} onValueChange={(role) => updateRole.mutate({ membershipId: u.membershipId!, role })}>
                            <SelectTrigger className="h-8 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {u.membershipId ? (
                          <Select value={u.companyId ?? ""} onValueChange={(companyId) => updateUserCompany.mutate({ membershipId: u.membershipId!, companyId })}>
                            <SelectTrigger className="h-8 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {companies.map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
