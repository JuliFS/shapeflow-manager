import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const saveError = (entity: string, error: any) => toast.error(`Erro ao salvar ${entity}: ${error?.message ?? "tente novamente"}`);
const removeError = (entity: string, error: any) => toast.error(`Erro ao remover ${entity}: ${error?.message ?? "tente novamente"}`);

function PrintersTab() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", purchase_cost: 0, lifespan_hours: 2000, power_consumption_watts: 200,
    energy_cost_per_kwh: 0.8, maintenance_cost_per_hour: 0.5,
  });

  const { data: printers = [] } = useQuery({
    queryKey: ["printers", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("printers").select("*").eq("company_id", currentCompanyId!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      if (!currentCompanyId) throw new Error("Empresa não selecionada");
      if (!form.name.trim()) throw new Error("Informe o nome da impressora");
      const payload = {
        name: form.name.trim(),
        purchase_cost: toNumber(form.purchase_cost),
        lifespan_hours: Math.max(1, toNumber(form.lifespan_hours, 1)),
        power_consumption_watts: toNumber(form.power_consumption_watts),
        energy_cost_per_kwh: toNumber(form.energy_cost_per_kwh),
        maintenance_cost_per_hour: toNumber(form.maintenance_cost_per_hour),
        cost_per_hour: costPerHour,
      };
      if (editId) {
        const { error } = await supabase.from("printers").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("printers").insert({ ...payload, user_id: user.id, company_id: currentCompanyId });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["printers"] });
      await qc.refetchQueries({ queryKey: ["printers", currentCompanyId] });
      setOpen(false);
      setEditId(null);
      toast.success(editId ? "Impressora atualizada!" : "Impressora criada com sucesso!");
    },
    onError: (e: any) => saveError("impressora", e),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("printers").delete().eq("id", id); if (error) throw error; },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["printers"] }); toast.success("Impressora removida!"); },
    onError: (e: any) => removeError("impressora", e),
  });

  const openEdit = (p: any) => {
    setForm({ name: p.name, purchase_cost: p.purchase_cost, lifespan_hours: p.lifespan_hours, power_consumption_watts: p.power_consumption_watts, energy_cost_per_kwh: p.energy_cost_per_kwh, maintenance_cost_per_hour: p.maintenance_cost_per_hour });
    setEditId(p.id);
    setOpen(true);
  };

  const costPerHour = (toNumber(form.purchase_cost) / Math.max(toNumber(form.lifespan_hours, 1), 1)) + ((toNumber(form.power_consumption_watts) / 1000) * toNumber(form.energy_cost_per_kwh)) + toNumber(form.maintenance_cost_per_hour);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditId(null); setForm({ name: "", purchase_cost: 0, lifespan_hours: 2000, power_consumption_watts: 200, energy_cost_per_kwh: 0.8, maintenance_cost_per_hour: 0.5 }); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Impressora
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Nova"} Impressora</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Custo da Impressora (R$)</Label><Input type="number" min={0} step={0.01} value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: +e.target.value })} /></div>
                <div className="space-y-2"><Label>Vida Útil (horas)</Label><Input type="number" min={1} value={form.lifespan_hours} onChange={(e) => setForm({ ...form, lifespan_hours: +e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Consumo (Watts)</Label><Input type="number" min={0} value={form.power_consumption_watts} onChange={(e) => setForm({ ...form, power_consumption_watts: +e.target.value })} /></div>
                <div className="space-y-2"><Label>Custo Energia (R$/kWh)</Label><Input type="number" min={0} step={0.01} value={form.energy_cost_per_kwh} onChange={(e) => setForm({ ...form, energy_cost_per_kwh: +e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Manutenção (R$/hora)</Label><Input type="number" min={0} step={0.01} value={form.maintenance_cost_per_hour} onChange={(e) => setForm({ ...form, maintenance_cost_per_hour: +e.target.value })} /></div>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Custo por hora calculado</p>
                  <p className="text-2xl font-bold text-primary">R$ {costPerHour.toFixed(2)}/h</p>
                </CardContent>
              </Card>
              <Button type="submit" className="w-full" disabled={save.isPending}>Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Custo Aquisição</TableHead><TableHead>Vida Útil</TableHead><TableHead>Custo/Hora</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
            <TableBody>
              {printers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma impressora</TableCell></TableRow>
              ) : printers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>R$ {p.purchase_cost.toFixed(2)}</TableCell>
                  <TableCell>{p.lifespan_hours}h</TableCell>
                  <TableCell className="font-semibold text-primary">R$ {(p.cost_per_hour ?? 0).toFixed(2)}/h</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MaterialsTab() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", color: "", brand: "", cost_per_kg: 0, density: 1.24 });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("materials").select("*").eq("company_id", currentCompanyId!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      if (!currentCompanyId) throw new Error("Empresa não selecionada");
      if (!form.name?.trim()) throw new Error("Informe o nome do material");
      if (!Number.isFinite(Number(form.cost_per_kg)) || Number(form.cost_per_kg) <= 0) throw new Error("Informe um custo por kg válido");
      const payload = {
        name: form.name.trim(),
        color: form.color?.trim() || null,
        brand: form.brand?.trim() || null,
        cost_per_kg: toNumber(form.cost_per_kg),
        density: toNumber(form.density, 1.24) || 1.24,
      };
      if (editId) {
        const { error } = await supabase.from("materials").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("materials").insert({ ...payload, user_id: user.id, company_id: currentCompanyId });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["materials"] });
      await qc.refetchQueries({ queryKey: ["materials", currentCompanyId] });
      setOpen(false);
      setEditId(null);
      setForm({ name: "", color: "", brand: "", cost_per_kg: 0, density: 1.24 });
      toast.success(editId ? "Material atualizado!" : "Material criado com sucesso!");
    },
    onError: (e: any) => toast.error(`Erro ao salvar material: ${e?.message ?? "tente novamente"}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("materials").delete().eq("id", id); if (error) throw error; },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["materials"] });
      await qc.refetchQueries({ queryKey: ["materials", currentCompanyId] });
      toast.success("Material removido!");
    },
    onError: (e: any) => toast.error(`Erro ao remover material: ${e?.message ?? "tente novamente"}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditId(null); setForm({ name: "", color: "", brand: "", cost_per_kg: 0, density: 1.24 }); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Material
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Material</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Material *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="PLA, ABS, PETG..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Cor</Label><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
                <div className="space-y-2"><Label>Marca</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Custo/kg (R$)</Label><Input type="number" min={0} step={0.01} value={form.cost_per_kg} onChange={(e) => setForm({ ...form, cost_per_kg: +e.target.value })} /></div>
                <div className="space-y-2"><Label>Densidade (g/cm³)</Label><Input type="number" min={0} step={0.01} value={form.density} onChange={(e) => setForm({ ...form, density: +e.target.value })} /></div>
              </div>
              <Button type="submit" className="w-full" disabled={save.isPending}>Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Cor</TableHead><TableHead>Marca</TableHead><TableHead>Custo/kg</TableHead><TableHead>Densidade</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
            <TableBody>
              {materials.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum material</TableCell></TableRow>
              ) : materials.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.color}</TableCell>
                  <TableCell>{m.brand}</TableCell>
                  <TableCell>R$ {m.cost_per_kg.toFixed(2)}</TableCell>
                  <TableCell>{m.density}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setForm({ name: m.name, color: m.color ?? "", brand: m.brand ?? "", cost_per_kg: m.cost_per_kg, density: m.density ?? 1.24 }); setEditId(m.id); setOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SoftwareTab() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", monthly_cost: 0, category: "" });

  const { data: sw = [] } = useQuery({
    queryKey: ["software", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("software").select("*").eq("company_id", currentCompanyId!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      if (!currentCompanyId) throw new Error("Empresa não selecionada");
      if (!form.name.trim()) throw new Error("Informe o nome do software");
      const payload = {
        name: form.name.trim(),
        monthly_cost: toNumber(form.monthly_cost),
        category: form.category?.trim() || null,
        user_id: user.id,
        company_id: currentCompanyId,
      };
      const { error } = await supabase.from("software").insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["software"] });
      await qc.refetchQueries({ queryKey: ["software", currentCompanyId] });
      setOpen(false);
      setForm({ name: "", monthly_cost: 0, category: "" });
      toast.success("Software salvo!");
    },
    onError: (e: any) => saveError("software", e),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("software").delete().eq("id", id); if (error) throw error; },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["software"] });
      await qc.refetchQueries({ queryKey: ["software", currentCompanyId] });
      toast.success("Software removido!");
    },
    onError: (e: any) => removeError("software", e),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({ name: "", monthly_cost: 0, category: "" })}>
              <Plus className="h-4 w-4 mr-1" /> Novo Software
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Software</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Custo Mensal (R$)</Label><Input type="number" min={0} step={0.01} value={form.monthly_cost} onChange={(e) => setForm({ ...form, monthly_cost: +e.target.value })} /></div>
                <div className="space-y-2"><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Modelagem, Fatiador..." /></div>
              </div>
              <Button type="submit" className="w-full" disabled={save.isPending}>Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Custo Mensal</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
            <TableBody>
              {sw.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum software</TableCell></TableRow>
              ) : sw.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.category}</TableCell>
                  <TableCell>R$ {s.monthly_cost.toFixed(2)}/mês</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  const { currentCompanyId, refetch } = useCompany();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", currentCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("company_id", currentCompanyId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompanyId,
  });

  const [form, setForm] = useState({
    company_name: "", owner_name: "", company_email: "", company_phone: "", company_address: "",
    hourly_rate: 50, modeling_hourly_rate: 80, default_margin: 30, company_logo_url: "",
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      company_name: profile.company_name ?? "",
      owner_name: profile.owner_name ?? "",
      company_email: profile.company_email ?? "",
      company_phone: profile.company_phone ?? "",
      company_address: profile.company_address ?? "",
      hourly_rate: profile.hourly_rate ?? 50,
      modeling_hourly_rate: profile.modeling_hourly_rate ?? 80,
      default_margin: (profile.default_margin ?? 0.3) * 100,
      company_logo_url: profile.company_logo_url ?? "",
    });
  }, [profile?.id]);

  const handleLogoUpload = async (file: File) => {
    if (!user || !currentCompanyId) { toast.error("Selecione uma empresa antes de enviar o logo"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${currentCompanyId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
      const logoUrl = urlData.publicUrl + "?t=" + Date.now();
      setForm((prev) => ({ ...prev, company_logo_url: logoUrl }));

      if (profile?.id) {
        const { error } = await supabase.from("profiles").update({ company_logo_url: logoUrl }).eq("id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("profiles").insert({
          user_id: user.id,
          company_id: currentCompanyId,
          company_logo_url: logoUrl,
          company_name: form.company_name || "",
          owner_name: form.owner_name || "",
          company_email: form.company_email || user.email || "",
        });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.refetchQueries({ queryKey: ["profile", currentCompanyId] });
      toast.success("Logo enviado com sucesso!");
    } catch (err: any) {
      toast.error(`Erro ao enviar logo: ${err?.message ?? "tente novamente"}`);
    } finally {
      setUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      if (!currentCompanyId) throw new Error("Empresa não selecionada");
      const payload = {
        company_name: form.company_name.trim(),
        owner_name: form.owner_name.trim(),
        company_email: form.company_email.trim(),
        company_phone: form.company_phone.trim(),
        company_address: form.company_address.trim(),
        hourly_rate: toNumber(form.hourly_rate, 50),
        modeling_hourly_rate: toNumber(form.modeling_hourly_rate, 80),
        default_margin: toNumber(form.default_margin, 30) / 100,
        company_logo_url: form.company_logo_url,
        user_id: user.id,
        company_id: currentCompanyId,
      };
      const { error } = profile?.id
        ? await supabase.from("profiles").update(payload).eq("id", profile.id)
        : await supabase.from("profiles").insert(payload);
      if (error) throw error;

      if (payload.company_name) {
        const { error: companyError } = await supabase
          .from("companies")
          .update({ name: payload.company_name })
          .eq("id", currentCompanyId);
        if (companyError) throw companyError;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.refetchQueries({ queryKey: ["profile", currentCompanyId] });
      await refetch();
      toast.success("Empresa salva com sucesso!");
    },
    onError: (e: any) => saveError("empresa", e),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Dados da Empresa</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4 max-w-lg">
          {/* Logo upload */}
          <div className="space-y-2">
            <Label>Logo da Empresa</Label>
            <div className="flex items-center gap-4">
              {form.company_logo_url ? (
                <img src={form.company_logo_url} alt="Logo" className="h-16 w-16 rounded-lg object-contain border border-border bg-background" />
              ) : (
                <div className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-xs">Logo</div>
              )}
              <div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                  <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                    <span>{uploading ? "Enviando..." : "Enviar Logo"}</span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground mt-1">PNG ou JPG, será exibido no PDF</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nome da Empresa</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Responsável</Label><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Email</Label><Input value={form.company_email} onChange={(e) => setForm({ ...form, company_email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={form.company_phone} onChange={(e) => setForm({ ...form, company_phone: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Endereço</Label><Input value={form.company_address} onChange={(e) => setForm({ ...form, company_address: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Valor Hora (R$)</Label><Input type="number" min={0} step={0.01} value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: +e.target.value })} /></div>
            <div className="space-y-2"><Label>Hora Modelagem (R$)</Label><Input type="number" min={0} step={0.01} value={form.modeling_hourly_rate} onChange={(e) => setForm({ ...form, modeling_hourly_rate: +e.target.value })} /></div>
            <div className="space-y-2"><Label>Margem Padrão (%)</Label><Input type="number" min={0} max={500} value={form.default_margin} onChange={(e) => setForm({ ...form, default_margin: +e.target.value })} /></div>
          </div>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar Perfil"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PricingTab() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["pricing_config", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pricing_config")
        .select("*")
        .eq("company_id", currentCompanyId!)
        .maybeSingle();
      return data;
    },
    enabled: !!currentCompanyId,
  });

  const [form, setForm] = useState({
    markup_3d_print: 100,
    markup_letra_caixa: 200,
    markup_fachada_completa: 300,
    min_profit_percent: 30,
  });
  const [loaded, setLoaded] = useState(false);

  if (config && !loaded) {
    setForm({
      markup_3d_print: Number(config.markup_3d_print),
      markup_letra_caixa: Number(config.markup_letra_caixa),
      markup_fachada_completa: Number(config.markup_fachada_completa),
      min_profit_percent: Number(config.min_profit_percent),
    });
    setLoaded(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!currentCompanyId) throw new Error("Empresa não selecionada");
      const payload = {
        markup_3d_print: Number(form.markup_3d_print) || 0,
        markup_letra_caixa: Number(form.markup_letra_caixa) || 0,
        markup_fachada_completa: Number(form.markup_fachada_completa) || 0,
        min_profit_percent: Number(form.min_profit_percent) || 0,
      };
      if (config) {
        const { error } = await supabase.from("pricing_config").update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pricing_config").insert({
          company_id: currentCompanyId,
          ...payload,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pricing_config"] });
      await qc.refetchQueries({ queryKey: ["pricing_config", currentCompanyId] });
      toast.success("Configurações de precificação salvas!");
    },
    onError: (e: any) => saveError("precificação", e),
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <Card>
      <CardHeader><CardTitle>Precificação Automática</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-6 max-w-lg">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Configure o markup padrão por tipo de projeto. Esses valores serão aplicados automaticamente ao criar novos orçamentos.</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>🖨️ Impressão 3D — Markup (%)</Label>
                <Input type="number" min={0} max={1000} value={form.markup_3d_print} onChange={(e) => setForm({ ...form, markup_3d_print: +e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>🔤 Letra Caixa — Markup (%)</Label>
                <Input type="number" min={0} max={1000} value={form.markup_letra_caixa} onChange={(e) => setForm({ ...form, markup_letra_caixa: +e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>🏢 Fachada Completa — Markup (%)</Label>
                <Input type="number" min={0} max={1000} value={form.markup_fachada_completa} onChange={(e) => setForm({ ...form, markup_fachada_completa: +e.target.value })} />
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-semibold">Proteção contra Prejuízo</p>
            <p className="text-xs text-muted-foreground">Se o markup aplicado gerar lucro menor que o mínimo, um alerta será exibido e o markup será ajustado automaticamente.</p>
            <div className="space-y-2">
              <Label>Lucro Mínimo (%)</Label>
              <Input type="number" min={0} max={500} value={form.min_profit_percent} onChange={(e) => setForm({ ...form, min_profit_percent: +e.target.value })} />
            </div>
          </div>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar Configurações"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CompanyPlanTab() {
  const { currentCompany } = useCompany();

  const plans = [
    { id: "free", name: "Free", desc: "Até 10 orçamentos/mês", features: ["10 orçamentos/mês", "Gestão básica", "1 usuário"] },
    { id: "pro", name: "Pro", desc: "Orçamentos ilimitados", features: ["Orçamentos ilimitados", "Multi-empresa", "Usuários ilimitados"] },
    { id: "studio", name: "Studio", desc: "Relatórios avançados", features: ["Tudo do Pro", "Relatórios avançados", "Exportação PDF", "Suporte prioritário"] },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((plan) => (
        <Card key={plan.id} className={currentCompany?.plan === plan.id ? "border-primary ring-2 ring-primary/20" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {plan.name}
              {currentCompany?.plan === plan.id && <Badge className="bg-primary text-primary-foreground">Atual</Badge>}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{plan.desc}</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TeamTab() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const { data: members = [] } = useQuery({
    queryKey: ["team_members", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_companies")
        .select("id, user_id, role, created_at")
        .eq("company_id", currentCompanyId!);
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_invitations")
        .select("*")
        .eq("company_id", currentCompanyId!)
        .order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      if (!inviteEmail.trim()) return;
      const email = inviteEmail.trim().toLowerCase();
      
      // Save invitation to DB
      const { error } = await supabase.from("company_invitations").insert({
        company_id: currentCompanyId!,
        email,
        role: inviteRole,
        invited_by: user!.id,
      } as any);
      if (error) throw error;

      // Get company name for the email
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", currentCompanyId!)
        .single();

      // Send invite email via edge function
      try {
        await supabase.functions.invoke("send-invite-email", {
          body: {
            email,
            companyName: company?.name ?? "3D Manager",
            role: inviteRole,
            siteUrl: window.location.origin,
          },
        });
      } catch (emailErr) {
        console.error("Email sending failed:", emailErr);
        // Don't fail the invite if email fails
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
      setInviteEmail("");
      toast.success("Convite enviado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Convite cancelado!");
    },
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_members"] });
      toast.success("Membro removido!");
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Convidar Membro</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); sendInvite.mutate(); }} className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label>Email</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@exemplo.com" required />
            </div>
            <div className="w-32 space-y-2">
              <Label>Função</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={sendInvite.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Convidar
            </Button>
          </form>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Convites</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell><Badge variant="secondary">{inv.role}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "accepted" ? "default" : "outline"} className={inv.status === "accepted" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""}>
                        {inv.status === "accepted" ? "Aceito" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.status === "pending" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => cancelInvite.mutate(inv.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Membros da Equipe</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.user_id === user?.id ? "Você" : m.user_id.slice(0, 8) + "..."}</TableCell>
                  <TableCell><Badge variant="secondary">{m.role}</Badge></TableCell>
                  <TableCell>
                    {m.user_id !== user?.id && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMember.mutate(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="pricing">Precificação</TabsTrigger>
          <TabsTrigger value="printers">Impressoras</TabsTrigger>
          <TabsTrigger value="materials">Materiais</TabsTrigger>
          <TabsTrigger value="software">Softwares</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="plan">Plano</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4"><ProfileTab /></TabsContent>
        <TabsContent value="pricing" className="mt-4"><PricingTab /></TabsContent>
        <TabsContent value="printers" className="mt-4"><PrintersTab /></TabsContent>
        <TabsContent value="materials" className="mt-4"><MaterialsTab /></TabsContent>
        <TabsContent value="software" className="mt-4"><SoftwareTab /></TabsContent>
        <TabsContent value="team" className="mt-4"><TeamTab /></TabsContent>
        <TabsContent value="plan" className="mt-4"><CompanyPlanTab /></TabsContent>
      </Tabs>
    </div>
  );
}
