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
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const emptyForm = {
  name: "",
  default_material_id: "",
  default_material_name: "",
  avg_weight_grams: 0,
  avg_print_time_hours: 0,
};

export default function Parts() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("materials").select("*").eq("company_id", currentCompanyId!);
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ["parts", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("parts").select("*").eq("company_id", currentCompanyId!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const save = useMutation({
    mutationFn: async () => {
      const mat = materials.find((m) => m.id === form.default_material_id);
      const payload = {
        ...form,
        default_material_id: form.default_material_id || null,
        default_material_name: mat?.name ?? form.default_material_name,
      };
      if (editId) {
        const { error } = await supabase.from("parts").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("parts").insert({
          ...payload,
          user_id: user!.id,
          company_id: currentCompanyId!,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parts"] });
      setOpen(false);
      setEditId(null);
      setForm({ ...emptyForm });
      toast.success(editId ? "Peça atualizada!" : "Peça salva!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parts"] });
      toast.success("Peça removida!");
    },
  });

  const openEdit = (p: any) => {
    setForm({
      name: p.name,
      default_material_id: p.default_material_id ?? "",
      default_material_name: p.default_material_name ?? "",
      avg_weight_grams: p.avg_weight_grams ?? 0,
      avg_print_time_hours: p.avg_print_time_hours ?? 0,
    });
    setEditId(p.id);
    setOpen(true);
  };

  const createQuoteFromPart = (p: any) => {
    // Navigate to quotes with part data in state
    navigate("/quotes", { state: { fromPart: p } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Biblioteca de Peças</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ ...emptyForm }); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditId(null); setForm({ ...emptyForm }); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Peça
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Peça" : "Nova Peça"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Peça *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Material Padrão</Label>
                <Select value={form.default_material_id} onValueChange={(v) => setForm({ ...form, default_material_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} - {m.color}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Peso Médio (g)</Label>
                  <Input type="number" min={0} step={0.1} value={form.avg_weight_grams} onChange={(e) => setForm({ ...form, avg_weight_grams: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tempo Médio (h)</Label>
                  <Input type="number" min={0} step={0.1} value={form.avg_print_time_hours} onChange={(e) => setForm({ ...form, avg_print_time_hours: +e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Peso Médio</TableHead>
                <TableHead>Tempo Médio</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma peça salva</TableCell>
                </TableRow>
              ) : (
                parts.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.default_material_name || "—"}</TableCell>
                    <TableCell>{p.avg_weight_grams}g</TableCell>
                    <TableCell>{p.avg_print_time_hours}h</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Criar orçamento" onClick={() => createQuoteFromPart(p)}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
