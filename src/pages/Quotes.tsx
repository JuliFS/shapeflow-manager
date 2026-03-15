import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, FileDown, Upload, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import jsPDF from "jspdf";
import type { Database } from "@/integrations/supabase/types";

type QuoteStatus = Database["public"]["Enums"]["quote_status"];

const statusLabels: Record<QuoteStatus, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  approved: "Aprovado",
  rejected: "Recusado",
};

const statusColors: Record<QuoteStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-destructive/10 text-destructive",
};

const emptyForm = {
  client_id: "",
  piece_name: "",
  printer_id: "",
  material_id: "",
  weight_grams: 0,
  print_time_hours: 0,
  finishing: "",
  post_processing_hours: 0,
  has_modeling: false,
  modeling_hours: 0,
  margin: 0.3,
  delivery_days: 7,
  payment_method: "",
  shipping_cost: 0,
  discount: 0,
};

export default function Quotes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editQuoteNumber, setEditQuoteNumber] = useState<string | null>(null);
  const [approvedWarning, setApprovedWarning] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: printers = [] } = useQuery({
    queryKey: ["printers", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("printers").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("materials").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("quotes").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const selectedPrinter = printers.find((p) => p.id === form.printer_id);
  const selectedMaterial = materials.find((m) => m.id === form.material_id);
  const selectedClient = clients.find((c) => c.id === form.client_id);

  const costs = useMemo(() => {
    const hourlyRate = profile?.hourly_rate ?? 50;
    const modelingRate = profile?.modeling_hourly_rate ?? 80;
    const costPerGram = selectedMaterial ? selectedMaterial.cost_per_kg / 1000 : 0;
    const machineRate = selectedPrinter?.cost_per_hour ?? 0;

    const material_cost = form.weight_grams * costPerGram;
    const machine_cost = form.print_time_hours * machineRate;
    const labor_cost = form.post_processing_hours * hourlyRate;
    const modeling_cost = form.has_modeling ? form.modeling_hours * modelingRate : 0;
    const total_cost = material_cost + machine_cost + labor_cost + modeling_cost;
    const base_price = total_cost * (1 + form.margin);
    const final_price = base_price - form.discount + form.shipping_cost;

    return { material_cost, machine_cost, labor_cost, modeling_cost, total_cost, base_price, final_price };
  }, [form, selectedPrinter, selectedMaterial, profile]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: form.client_id || null,
        client_name: selectedClient?.name ?? "",
        piece_name: form.piece_name,
        printer_id: form.printer_id || null,
        printer_name: selectedPrinter?.name ?? "",
        material_id: form.material_id || null,
        material_name: selectedMaterial?.name ?? "",
        weight_grams: form.weight_grams,
        print_time_hours: form.print_time_hours,
        finishing: form.finishing,
        post_processing_hours: form.post_processing_hours,
        has_modeling: form.has_modeling,
        modeling_hours: form.modeling_hours,
        margin: form.margin,
        delivery_days: form.delivery_days,
        payment_method: form.payment_method,
        shipping_cost: form.shipping_cost,
        discount: form.discount,
        ...costs,
      };

      if (editId) {
        const { error } = await supabase.from("quotes").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const now = new Date();
        const quoteNumber = format(now, "ddMMyyyyHHmm");
        const { error } = await supabase.from("quotes").insert({
          user_id: user!.id,
          quote_number: quoteNumber,
          status: "draft" as QuoteStatus,
          ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      setOpen(false);
      setEditId(null);
      setEditQuoteNumber(null);
      toast.success(editId ? "Orçamento atualizado!" : "Orçamento criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: QuoteStatus }) => {
      const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
      if (error) throw error;
      if (status === "approved") {
        const quote = quotes.find((q) => q.id === id);
        if (quote) {
          const { error: orderError } = await supabase.from("orders").insert({
            user_id: user!.id,
            quote_id: id,
            quote_number: quote.quote_number,
            client_name: quote.client_name,
            piece_name: quote.piece_name,
            final_price: quote.final_price,
            status: "queue" as Database["public"]["Enums"]["order_status"],
          });
          if (orderError) throw orderError;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (q: any) => {
    if (q.status === "approved") {
      setApprovedWarning(q);
      return;
    }
    fillFormForEdit(q);
  };

  const fillFormForEdit = (q: any) => {
    setForm({
      client_id: q.client_id ?? "",
      piece_name: q.piece_name,
      printer_id: q.printer_id ?? "",
      material_id: q.material_id ?? "",
      weight_grams: q.weight_grams ?? 0,
      print_time_hours: q.print_time_hours ?? 0,
      finishing: q.finishing ?? "",
      post_processing_hours: q.post_processing_hours ?? 0,
      has_modeling: q.has_modeling ?? false,
      modeling_hours: q.modeling_hours ?? 0,
      margin: q.margin ?? 0.3,
      delivery_days: q.delivery_days ?? 7,
      payment_method: q.payment_method ?? "",
      shipping_cost: q.shipping_cost ?? 0,
      discount: (q as any).discount ?? 0,
    });
    setEditId(q.id);
    setEditQuoteNumber(q.quote_number);
    setOpen(true);
  };

  const openNew = () => {
    setForm({ ...emptyForm, margin: profile?.default_margin ?? 0.3 });
    setEditId(null);
    setEditQuoteNumber(null);
    setOpen(true);
  };

  const generatePDF = (quote: typeof quotes[0]) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();

    // Logo / Company name
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(profile?.company_name || "3D Manager", pw / 2, 25, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("ORÇAMENTO", pw / 2, 35, { align: "center" });

    doc.setFontSize(9);
    doc.text(`Nº ${quote.quote_number}`, pw / 2, 42, { align: "center" });

    doc.setDrawColor(200);
    doc.line(20, 48, pw - 20, 48);

    let y = 58;
    doc.setFontSize(10);
    doc.text(`Cliente: ${quote.client_name || "—"}`, 20, y);
    doc.text(`Data: ${format(new Date(quote.created_at), "dd/MM/yyyy")}`, pw - 20, y, { align: "right" });
    y += 8;
    doc.text(`Peça: ${quote.piece_name}`, 20, y);
    y += 8;
    doc.text(`Material: ${quote.material_name || "—"}`, 20, y);

    // Financial summary (commercial only)
    const shippingCost = quote.shipping_cost ?? 0;
    const discount = (quote as any).discount ?? 0;
    const basePrice = (quote.final_price ?? 0) + discount - shippingCost;

    y += 20;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Resumo Financeiro", 20, y);
    y += 8;
    doc.text(`Valor da peça: R$ ${basePrice.toFixed(2)}`, 30, y);
    if (discount > 0) {
      y += 7;
      doc.text(`Desconto: - R$ ${discount.toFixed(2)}`, 30, y);
    }
    if (shippingCost > 0) {
      y += 7;
      doc.text(`Frete: + R$ ${shippingCost.toFixed(2)}`, 30, y);
    }

    // TOTAL highlight
    y += 15;
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(30, y - 8, pw - 60, 30, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text("TOTAL", pw / 2, y + 2, { align: "center" });
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(`R$ ${(quote.final_price ?? 0).toFixed(2)}`, pw / 2, y + 16, { align: "center" });

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    y += 40;
    doc.setFontSize(10);
    doc.text(`Prazo de entrega: ${quote.delivery_days ?? "—"} dias`, 20, y);
    y += 8;
    doc.text(`Forma de pagamento: ${quote.payment_method || "A combinar"}`, 20, y);

    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(8);
    doc.setTextColor(120);
    const footerLines = [
      profile?.company_name || "",
      [profile?.company_phone, profile?.company_email].filter(Boolean).join(" • "),
      profile?.company_address || "",
    ].filter(Boolean);
    footerLines.forEach((line, i) => {
      doc.text(line, pw / 2, footerY + i * 4, { align: "center" });
    });

    doc.save(`orcamento-${quote.quote_number}.pdf`);
  };

  const handleStlUpload = async (quoteId: string, file: File) => {
    const path = `${user!.id}/${quoteId}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("stl-files").upload(path, file);
    if (uploadError) {
      toast.error("Erro ao enviar arquivo");
      return;
    }
    const { data: urlData } = supabase.storage.from("stl-files").getPublicUrl(path);
    await supabase.from("quotes").update({ stl_file_url: urlData.publicUrl }).eq("id", quoteId);
    qc.invalidateQueries({ queryKey: ["quotes"] });
    toast.success("Arquivo STL enviado!");
  };

  return (
    <div className="space-y-6">
      {/* Approved edit warning */}
      <AlertDialog open={!!approvedWarning} onOpenChange={() => setApprovedWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Orçamento Aprovado</AlertDialogTitle>
            <AlertDialogDescription>
              Este orçamento já foi aprovado e um pedido foi gerado. Editar pode causar inconsistências. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { fillFormForEdit(approvedWarning); setApprovedWarning(null); }}>
              Editar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Orçamentos</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setEditQuoteNumber(null); } }}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Orçamento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editId ? `Editar Orçamento #${editQuoteNumber}` : "Calculadora de Impressão 3D"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome da Peça *</Label>
                  <Input value={form.piece_name} onChange={(e) => setForm({ ...form, piece_name: e.target.value })} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Impressora</Label>
                  <Select value={form.printer_id} onValueChange={(v) => setForm({ ...form, printer_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {printers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} (R$ {p.cost_per_hour?.toFixed(2)}/h)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Material</Label>
                  <Select value={form.material_id} onValueChange={(v) => setForm({ ...form, material_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} - {m.color}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Peso (g)</Label>
                  <Input type="number" min={0} step={0.1} value={form.weight_grams} onChange={(e) => setForm({ ...form, weight_grams: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tempo Impressão (h)</Label>
                  <Input type="number" min={0} step={0.1} value={form.print_time_hours} onChange={(e) => setForm({ ...form, print_time_hours: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Pós-processamento (h)</Label>
                  <Input type="number" min={0} step={0.1} value={form.post_processing_hours} onChange={(e) => setForm({ ...form, post_processing_hours: +e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Acabamento</Label>
                <Input value={form.finishing} onChange={(e) => setForm({ ...form, finishing: e.target.value })} placeholder="Ex: lixamento, pintura" />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={form.has_modeling} onCheckedChange={(v) => setForm({ ...form, has_modeling: v })} />
                  <Label>Possui modelagem</Label>
                </div>
                {form.has_modeling && (
                  <div className="space-y-2 flex-1">
                    <Label>Horas de modelagem</Label>
                    <Input type="number" min={0} step={0.5} value={form.modeling_hours} onChange={(e) => setForm({ ...form, modeling_hours: +e.target.value })} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Margem (%)</Label>
                  <Input type="number" min={0} max={500} step={1} value={form.margin * 100} onChange={(e) => setForm({ ...form, margin: +e.target.value / 100 })} />
                </div>
                <div className="space-y-2">
                  <Label>Desconto (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={form.discount} onChange={(e) => setForm({ ...form, discount: +e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frete (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={form.shipping_cost} onChange={(e) => setForm({ ...form, shipping_cost: +e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prazo (dias)</Label>
                  <Input type="number" min={1} value={form.delivery_days} onChange={(e) => setForm({ ...form, delivery_days: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Pagamento</Label>
                  <Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="PIX, cartão..." />
                </div>
              </div>

              {/* Detalhamento de Custos (interno) */}
              <Card className="bg-muted/50 border-dashed">
                <CardContent className="pt-4 space-y-1 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detalhamento de Custos (interno)</p>
                  <div className="flex justify-between"><span>Custo Material:</span><span>R$ {costs.material_cost.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Custo Máquina:</span><span>R$ {costs.machine_cost.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Custo Trabalho:</span><span>R$ {costs.labor_cost.toFixed(2)}</span></div>
                  {form.has_modeling && <div className="flex justify-between"><span>Custo Modelagem:</span><span>R$ {costs.modeling_cost.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-medium border-t border-border pt-1"><span>Custo Total:</span><span>R$ {costs.total_cost.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Margem ({(form.margin * 100).toFixed(0)}%):</span><span>R$ {(costs.base_price - costs.total_cost).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Preço Base:</span><span>R$ {costs.base_price.toFixed(2)}</span></div>
                  {form.discount > 0 && <div className="flex justify-between text-green-600"><span>Desconto:</span><span>- R$ {form.discount.toFixed(2)}</span></div>}
                  {form.shipping_cost > 0 && <div className="flex justify-between"><span>Frete:</span><span>+ R$ {form.shipping_cost.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-bold text-lg text-primary border-t border-border pt-1">
                    <span>Preço Final:</span><span>R$ {costs.final_price.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" className="w-full" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : editId ? "Salvar Alterações" : "Criar Orçamento"}
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
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Peça</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-48"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum orçamento</TableCell>
                </TableRow>
              ) : (
                quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.quote_number}</TableCell>
                    <TableCell>{q.client_name}</TableCell>
                    <TableCell>{q.piece_name}</TableCell>
                    <TableCell className="font-semibold">R$ {(q.final_price ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[q.status]}>{statusLabels[q.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(q)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {q.status === "draft" && (
                          <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: q.id, status: "sent" })}>Enviar</Button>
                        )}
                        {q.status === "sent" && (
                          <>
                            <Button variant="ghost" size="sm" className="text-green-600" onClick={() => updateStatus.mutate({ id: q.id, status: "approved" })}>Aprovar</Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => updateStatus.mutate({ id: q.id, status: "rejected" })}>Recusar</Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => generatePDF(q)}>
                          <FileDown className="h-3.5 w-3.5" />
                        </Button>
                        <label className="cursor-pointer">
                          <input type="file" accept=".stl" className="hidden" onChange={(e) => e.target.files?.[0] && handleStlUpload(q.id, e.target.files[0])} />
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <span><Upload className="h-3.5 w-3.5" /></span>
                          </Button>
                        </label>
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
