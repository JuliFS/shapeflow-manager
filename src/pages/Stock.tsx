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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Stock() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ material_id: "", material_name: "", initial_weight_g: 1000, remaining_weight_g: 1000 });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("materials").select("*").eq("company_id", currentCompanyId!);
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const { data: stock = [] } = useQuery({
    queryKey: ["stock", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("filament_stock").select("*").eq("company_id", currentCompanyId!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      if (!currentCompanyId) throw new Error("Empresa não selecionada");
      if (!form.material_id && !form.material_name.trim()) throw new Error("Selecione ou informe um material");
      if (!Number.isFinite(Number(form.initial_weight_g)) || Number(form.initial_weight_g) <= 0) throw new Error("Informe um peso inicial válido");
      const mat = materials.find((m) => m.id === form.material_id);
      const { error } = await supabase.from("filament_stock").insert({
        user_id: user.id,
        company_id: currentCompanyId,
        material_id: form.material_id || null,
        material_name: mat?.name ?? form.material_name.trim(),
        initial_weight_g: Number(form.initial_weight_g),
        remaining_weight_g: Number(form.initial_weight_g),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock"] });
      await qc.refetchQueries({ queryKey: ["stock", currentCompanyId] });
      setOpen(false);
      setForm({ material_id: "", material_name: "", initial_weight_g: 1000, remaining_weight_g: 1000 });
      toast.success("Estoque adicionado!");
    },
    onError: (e: any) => toast.error(`Erro ao salvar estoque: ${e?.message ?? "tente novamente"}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("filament_stock").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Removido!");
    },
    onError: (e: any) => toast.error(`Erro ao remover estoque: ${e?.message ?? "tente novamente"}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Estoque de Filamento</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Filamento</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Material</Label>
                <Select value={form.material_id} onValueChange={(v) => {
                  const m = materials.find((m) => m.id === v);
                  setForm({ ...form, material_id: v, material_name: m?.name ?? "" });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} - {m.color} ({m.brand})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Peso Inicial (g)</Label>
                <Input type="number" min={1} value={form.initial_weight_g} onChange={(e) => setForm({ ...form, initial_weight_g: +e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={save.isPending}>Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Peso Inicial</TableHead>
                <TableHead>Peso Restante</TableHead>
                <TableHead>Uso</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum estoque</TableCell></TableRow>
              ) : (
                stock.map((s) => {
                  const pct = s.initial_weight_g > 0 ? (s.remaining_weight_g / s.initial_weight_g) * 100 : 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.material_name}</TableCell>
                      <TableCell>{s.initial_weight_g}g</TableCell>
                      <TableCell>{s.remaining_weight_g}g</TableCell>
                      <TableCell className="w-40">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className={`text-xs font-medium ${pct < 20 ? "text-destructive" : "text-muted-foreground"}`}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
