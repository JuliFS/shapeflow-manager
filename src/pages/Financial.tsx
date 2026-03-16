import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

function ReceitasTab() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: 0, date: format(new Date(), "yyyy-MM-dd"), category: "", description: "" });

  const { data: records = [] } = useQuery({
    queryKey: ["financials-income", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("financial_records").select("*").eq("company_id", currentCompanyId!).eq("type", "income").order("date", { ascending: false });
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("financial_records").insert({ user_id: user!.id, company_id: currentCompanyId!, type: "income", ...form });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financials-income"] }); qc.invalidateQueries({ queryKey: ["financials"] }); setOpen(false); toast.success("Receita adicionada!"); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("financial_records").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financials-income"] }); qc.invalidateQueries({ queryKey: ["financials"] }); toast.success("Removido!"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nova Receita</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Receita</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" min={0} step={0.01} value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} required /></div>
                <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
              </div>
              <div className="space-y-2"><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Venda, Serviço..." /></div>
              <div className="space-y-2"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={save.isPending}>Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
          <TableBody>
            {records.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma receita</TableCell></TableRow> : records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.date), "dd/MM/yyyy")}</TableCell>
                <TableCell>{r.category}</TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell className="font-semibold text-green-600">R$ {r.amount.toFixed(2)}</TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function DespesasFixasTab() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", monthly_amount: 0, due_day: 1, active: true });

  const { data: records = [] } = useQuery({
    queryKey: ["fixed_expenses", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("fixed_expenses").select("*").eq("company_id", currentCompanyId!).order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fixed_expenses").insert({ user_id: user!.id, company_id: currentCompanyId!, ...form } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fixed_expenses"] }); setOpen(false); toast.success("Despesa fixa adicionada!"); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("fixed_expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fixed_expenses"] }); toast.success("Removido!"); },
  });

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("fixed_expenses").update({ active } as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["fixed_expenses"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nova Despesa Fixa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Despesa Fixa</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Ex: Energia, Aluguel..." /></div>
              <div className="space-y-2"><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Infraestrutura, Serviços..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Valor Mensal (R$)</Label><Input type="number" min={0} step={0.01} value={form.monthly_amount} onChange={(e) => setForm({ ...form, monthly_amount: +e.target.value })} required /></div>
                <div className="space-y-2"><Label>Dia de Vencimento</Label><Input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm({ ...form, due_day: +e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
              <Button type="submit" className="w-full" disabled={save.isPending}>Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Valor Mensal</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
          <TableBody>
            {records.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma despesa fixa</TableCell></TableRow> : records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.category}</TableCell>
                <TableCell className="font-semibold text-destructive">R$ {Number(r.monthly_amount).toFixed(2)}</TableCell>
                <TableCell>Dia {r.due_day}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={r.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"} onClick={() => toggleActive(r.id, !r.active)} style={{ cursor: "pointer" }}>
                    {r.active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function DespesasVariaveisTab() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", amount: 0, date: format(new Date(), "yyyy-MM-dd"), notes: "" });

  const { data: records = [] } = useQuery({
    queryKey: ["variable_expenses", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("variable_expenses").select("*").eq("company_id", currentCompanyId!).order("date", { ascending: false });
      return (data as any[]) ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("variable_expenses").insert({ user_id: user!.id, company_id: currentCompanyId!, ...form } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["variable_expenses"] }); setOpen(false); toast.success("Despesa variável adicionada!"); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("variable_expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["variable_expenses"] }); toast.success("Removido!"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nova Despesa Variável</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Despesa Variável</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Ex: Manutenção, Embalagem..." /></div>
              <div className="space-y-2"><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Produção, Logística..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" min={0} step={0.01} value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} required /></div>
                <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
              </div>
              <div className="space-y-2"><Label>Observação</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={save.isPending}>Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Observação</TableHead><TableHead>Valor</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
          <TableBody>
            {records.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma despesa variável</TableCell></TableRow> : records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.date), "dd/MM/yyyy")}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.category}</TableCell>
                <TableCell>{r.notes}</TableCell>
                <TableCell className="font-semibold text-destructive">R$ {Number(r.amount).toFixed(2)}</TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function ProLaboreTab() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: 0, date: format(new Date(), "yyyy-MM-dd"), notes: "" });

  const { data: records = [] } = useQuery({
    queryKey: ["pro_labore", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("pro_labore").select("*").eq("company_id", currentCompanyId!).order("date", { ascending: false });
      return (data as any[]) ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pro_labore").insert({ user_id: user!.id, company_id: currentCompanyId!, ...form } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pro_labore"] }); setOpen(false); toast.success("Pró-labore adicionado!"); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("pro_labore").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pro_labore"] }); toast.success("Removido!"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Novo Pró-labore</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Pró-labore</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" min={0} step={0.01} value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} required /></div>
                <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
              </div>
              <div className="space-y-2"><Label>Observação</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={save.isPending}>Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Observação</TableHead><TableHead>Valor</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
          <TableBody>
            {records.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum pró-labore</TableCell></TableRow> : records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.date), "dd/MM/yyyy")}</TableCell>
                <TableCell>{r.notes}</TableCell>
                <TableCell className="font-semibold text-destructive">R$ {Number(r.amount).toFixed(2)}</TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function DistribuicaoLucrosTab() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: 0, date: format(new Date(), "yyyy-MM-dd"), notes: "" });

  const { data: records = [] } = useQuery({
    queryKey: ["profit_distribution", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("profit_distribution").select("*").eq("company_id", currentCompanyId!).order("date", { ascending: false });
      return (data as any[]) ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profit_distribution").insert({ user_id: user!.id, company_id: currentCompanyId!, ...form } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profit_distribution"] }); setOpen(false); toast.success("Distribuição adicionada!"); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("profit_distribution").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profit_distribution"] }); toast.success("Removido!"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nova Distribuição</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Distribuição de Lucros</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" min={0} step={0.01} value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} required /></div>
                <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
              </div>
              <div className="space-y-2"><Label>Observação</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={save.isPending}>Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Observação</TableHead><TableHead>Valor</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
          <TableBody>
            {records.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma distribuição</TableCell></TableRow> : records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.date), "dd/MM/yyyy")}</TableCell>
                <TableCell>{r.notes}</TableCell>
                <TableCell className="font-semibold text-primary">R$ {Number(r.amount).toFixed(2)}</TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

export default function Financial() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
      <Tabs defaultValue="receitas">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="receitas">Receitas</TabsTrigger>
          <TabsTrigger value="fixas">Desp. Fixas</TabsTrigger>
          <TabsTrigger value="variaveis">Desp. Variáveis</TabsTrigger>
          <TabsTrigger value="prolabore">Pró-labore</TabsTrigger>
          <TabsTrigger value="lucros">Dist. Lucros</TabsTrigger>
        </TabsList>
        <TabsContent value="receitas" className="mt-4"><ReceitasTab /></TabsContent>
        <TabsContent value="fixas" className="mt-4"><DespesasFixasTab /></TabsContent>
        <TabsContent value="variaveis" className="mt-4"><DespesasVariaveisTab /></TabsContent>
        <TabsContent value="prolabore" className="mt-4"><ProLaboreTab /></TabsContent>
        <TabsContent value="lucros" className="mt-4"><DistribuicaoLucrosTab /></TabsContent>
      </Tabs>
    </div>
  );
}
