import { useState, useMemo, useEffect, useRef } from "react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, FileDown, Upload, Pencil, Trash2, Loader2, Box } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useLocation } from "react-router-dom";
import jsPDF from "jspdf";
import type { Database } from "@/integrations/supabase/types";
import { parseSTLVolume, analyzeSTL } from "@/lib/stl-parser";
import { LetraCaixaForm, emptyLetraCaixa, calcLetraCaixaCosts, type LetraCaixaData } from "@/components/quotes/LetraCaixaForm";
import { FachadaCompletaForm, emptyFachada, calcFachadaCosts, type FachadaData } from "@/components/quotes/FachadaCompletaForm";

type QuoteStatus = Database["public"]["Enums"]["quote_status"];
type QuoteType = "3d_print" | "letra_caixa" | "fachada_completa";

const statusLabels: Record<QuoteStatus, string> = {
  draft: "Rascunho", sent: "Enviado", approved: "Aprovado", rejected: "Recusado",
};
const statusColors: Record<QuoteStatus, string> = {
  draft: "bg-muted text-muted-foreground", sent: "bg-primary/10 text-primary",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-destructive/10 text-destructive",
};

const quoteTypeLabels: Record<QuoteType, string> = {
  "3d_print": "Impressão 3D",
  "letra_caixa": "Letra Caixa",
  "fachada_completa": "Fachada Completa",
};

const emptyForm = {
  client_id: "", piece_name: "", printer_id: "", material_id: "",
  weight_grams: 0, print_time_hours: 0, finishing: "", post_processing_hours: 0,
  has_modeling: false, modeling_hours: 0, margin: 0.3, delivery_days: 7,
  payment_method: "", shipping_cost: 0, discount: 0,
};

export default function Quotes() {
  const { user } = useAuth();
  const { currentCompanyId, currentCompany } = useCompany();
  const qc = useQueryClient();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editQuoteNumber, setEditQuoteNumber] = useState<string | null>(null);
  const [approvedWarning, setApprovedWarning] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [stlParsing, setStlParsing] = useState(false);
  const [stlVolume, setStlVolume] = useState<number | null>(null);
  const stlInputRef = useRef<HTMLInputElement>(null);
  const [quoteType, setQuoteType] = useState<QuoteType>("3d_print");
  const [letraCaixaData, setLetraCaixaData] = useState<LetraCaixaData>({ ...emptyLetraCaixa });
  const [fachadaData, setFachadaData] = useState<FachadaData>({ ...emptyFachada });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("company_id", currentCompanyId!);
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const { data: printers = [] } = useQuery({
    queryKey: ["printers", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("printers").select("*").eq("company_id", currentCompanyId!);
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("materials").select("*").eq("company_id", currentCompanyId!);
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("quotes").select("*").eq("company_id", currentCompanyId!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("company_id", currentCompanyId!).single();
      return data;
    },
    enabled: !!currentCompanyId,
  });

  const monthlyQuoteCount = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return quotes.filter((q) => q.created_at >= monthStart).length;
  }, [quotes]);

  const isFreePlan = currentCompany?.plan === "free";
  const quoteLimitReached = isFreePlan && monthlyQuoteCount >= 10;

  useEffect(() => {
    const state = location.state as any;
    if (state?.fromPart) {
      const p = state.fromPart;
      setForm({
        ...emptyForm,
        piece_name: p.name,
        material_id: p.default_material_id ?? "",
        weight_grams: p.avg_weight_grams ?? 0,
        print_time_hours: p.avg_print_time_hours ?? 0,
        margin: profile?.default_margin ?? 0.3,
      });
      setQuoteType("3d_print");
      setEditId(null);
      setEditQuoteNumber(null);
      setOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, profile]);

  const selectedPrinter = printers.find((p) => p.id === form.printer_id);
  const selectedMaterial = materials.find((m) => m.id === form.material_id);
  const selectedClient = clients.find((c) => c.id === form.client_id);

  // 3D Print costs
  const costs3d = useMemo(() => {
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

  // Letra Caixa costs
  const costsLC = useMemo(() => {
    const hourlyRate = profile?.hourly_rate ?? 50;
    const modelingRate = profile?.modeling_hourly_rate ?? 80;
    const getMaterialCostPerGram = (id: string) => {
      const m = materials.find((mat) => mat.id === id);
      return m ? m.cost_per_kg / 1000 : 0;
    };
    const getMachineRate = () => {
      const p = printers[0]; // use first printer as default for LC
      return p?.cost_per_hour ?? 0;
    };
    const c = calcLetraCaixaCosts(letraCaixaData, hourlyRate, modelingRate, getMaterialCostPerGram, getMachineRate);
    const base_price = c.total * (1 + form.margin);
    const final_price = base_price - form.discount + form.shipping_cost;
    return { ...c, base_price, final_price };
  }, [letraCaixaData, form.margin, form.discount, form.shipping_cost, profile, materials, printers]);

  // Fachada costs
  const costsFC = useMemo(() => {
    const c = calcFachadaCosts(fachadaData);
    const base_price = c.total * (1 + form.margin);
    const final_price = base_price - form.discount + form.shipping_cost;
    return { ...c, base_price, final_price };
  }, [fachadaData, form.margin, form.discount, form.shipping_cost]);

  const currentTotalCost = quoteType === "3d_print" ? costs3d.total_cost : quoteType === "letra_caixa" ? costsLC.total : costsFC.total;
  const currentBasePrice = quoteType === "3d_print" ? costs3d.base_price : quoteType === "letra_caixa" ? costsLC.base_price : costsFC.base_price;
  const currentFinalPrice = quoteType === "3d_print" ? costs3d.final_price : quoteType === "letra_caixa" ? costsLC.final_price : costsFC.final_price;

  // STL file handler
  const handleSTLInForm = async (file: File) => {
    setStlParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const volumeCm3 = parseSTLVolume(buffer);
      const density = selectedMaterial?.density ?? 1.24;
      const analysis = analyzeSTL(volumeCm3, density);
      setStlVolume(volumeCm3);
      setForm((prev) => ({
        ...prev,
        weight_grams: analysis.weightGrams,
        print_time_hours: analysis.estimatedPrintTimeHours,
      }));
      toast.success(`STL analisado: ${volumeCm3.toFixed(1)} cm³ — ${analysis.weightGrams}g — ~${analysis.estimatedPrintTimeHours}h`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar STL");
    } finally {
      setStlParsing(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const basePayload: any = {
        client_id: form.client_id || null,
        client_name: selectedClient?.name ?? "",
        piece_name: form.piece_name,
        margin: form.margin,
        delivery_days: form.delivery_days,
        payment_method: form.payment_method,
        shipping_cost: form.shipping_cost,
        discount: form.discount,
        quote_type: quoteType,
      };

      if (quoteType === "3d_print") {
        Object.assign(basePayload, {
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
          ...costs3d,
          quote_data: {},
        });
      } else if (quoteType === "letra_caixa") {
        const totalPrintTime = letraCaixaData.pieces.reduce((s, p) => s + p.print_time_hours, 0);
        const totalWeight = letraCaixaData.pieces.reduce((s, p) => s + p.weight_grams, 0);
        Object.assign(basePayload, {
          material_name: letraCaixaData.pieces.map(p => p.material_name).filter(Boolean).join(", ") || "—",
          weight_grams: totalWeight,
          print_time_hours: totalPrintTime,
          total_cost: costsLC.total,
          base_price: costsLC.base_price,
          final_price: costsLC.final_price,
          quote_data: letraCaixaData,
        });
      } else {
        Object.assign(basePayload, {
          material_name: fachadaData.base_material,
          weight_grams: 0,
          print_time_hours: 0,
          total_cost: costsFC.total,
          base_price: costsFC.base_price,
          final_price: costsFC.final_price,
          quote_data: fachadaData,
        });
      }

      if (editId) {
        const { error } = await supabase.from("quotes").update(basePayload).eq("id", editId);
        if (error) throw error;
      } else {
        const now = new Date();
        const quoteNumber = format(now, "ddMMyyyyHHmm");
        const { error } = await supabase.from("quotes").insert({
          user_id: user!.id,
          company_id: currentCompanyId!,
          quote_number: quoteNumber,
          status: "draft" as QuoteStatus,
          ...basePayload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      setOpen(false);
      setEditId(null);
      setEditQuoteNumber(null);
      setStlVolume(null);
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
            company_id: currentCompanyId!,
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
    if (q.status === "approved") { setApprovedWarning(q); return; }
    fillFormForEdit(q);
  };

  const fillFormForEdit = (q: any) => {
    setForm({
      client_id: q.client_id ?? "", piece_name: q.piece_name,
      printer_id: q.printer_id ?? "", material_id: q.material_id ?? "",
      weight_grams: q.weight_grams ?? 0, print_time_hours: q.print_time_hours ?? 0,
      finishing: q.finishing ?? "", post_processing_hours: q.post_processing_hours ?? 0,
      has_modeling: q.has_modeling ?? false, modeling_hours: q.modeling_hours ?? 0,
      margin: q.margin ?? 0.3, delivery_days: q.delivery_days ?? 7,
      payment_method: q.payment_method ?? "", shipping_cost: q.shipping_cost ?? 0,
      discount: q.discount ?? 0,
    });
    const type = (q.quote_type || "3d_print") as QuoteType;
    setQuoteType(type);
    if (type === "letra_caixa" && q.quote_data) {
      setLetraCaixaData({ ...emptyLetraCaixa, ...(q.quote_data as any) });
    } else if (type === "fachada_completa" && q.quote_data) {
      setFachadaData({ ...emptyFachada, ...(q.quote_data as any) });
    }
    setEditId(q.id);
    setEditQuoteNumber(q.quote_number);
    setStlVolume(null);
    setOpen(true);
  };

  const openNew = () => {
    setForm({ ...emptyForm, margin: profile?.default_margin ?? 0.3 });
    setQuoteType("3d_print");
    setLetraCaixaData({ ...emptyLetraCaixa });
    setFachadaData({ ...emptyFachada });
    setEditId(null);
    setEditQuoteNumber(null);
    setStlVolume(null);
    setOpen(true);
  };

  const generatePDF = async (quote: typeof quotes[0]) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ml = 20;
    const mr = pw - 20;
    const qType = ((quote as any).quote_type || "3d_print") as QuoteType;

    // ── Load logo ──
    let logoLoaded = false;
    if (profile?.company_logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = profile.company_logo_url!;
        });
        doc.addImage(img, "PNG", ml, 12, 28, 28);
        logoLoaded = true;
      } catch { /* skip */ }
    }

    // ── Header ──
    const headerX = logoLoaded ? ml + 34 : ml;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(profile?.company_name || currentCompany?.name || "3D Manager", headerX, 22);
    if (profile?.company_phone) {
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
      doc.text(profile.company_phone, headerX, 28);
    }
    if (profile?.company_address) {
      doc.setFontSize(8); doc.text(profile.company_address, headerX, 33);
    }

    doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.setTextColor(37, 99, 235);
    doc.text("ORÇAMENTO", mr, 22, { align: "right" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
    doc.text(`Nº ${quote.quote_number}`, mr, 29, { align: "right" });
    doc.text(`Data: ${format(new Date(quote.created_at), "dd/MM/yyyy")}`, mr, 35, { align: "right" });

    // ── Divider ──
    let y = 48;
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.8); doc.line(ml, y, mr, y);

    // ── Client ──
    y += 12;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(ml, y - 5, pw - 40, 28, 3, 3, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 116, 139);
    doc.text("CLIENTE", ml + 6, y + 1);
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59);
    doc.text(quote.client_name || "—", ml + 6, y + 10);
    const client = clients.find(c => c.id === quote.client_id);
    if (client?.cpf) {
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
      doc.text(`CPF: ${client.cpf}`, ml + 6, y + 17);
    }

    // ── Project description ──
    y += 38;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(ml, y - 5, pw - 40, 28, 3, 3, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 116, 139);

    if (qType === "3d_print") {
      doc.text("PEÇA", ml + 6, y + 1);
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59);
      doc.text(quote.piece_name, ml + 6, y + 10);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
      doc.text(`Material: ${quote.material_name || "—"}`, mr - 6, y + 10, { align: "right" });
    } else if (qType === "letra_caixa") {
      const lcData = (quote as any).quote_data as LetraCaixaData | undefined;
      doc.text("LETRA CAIXA", ml + 6, y + 1);
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59);
      doc.text(lcData?.project_name || quote.piece_name, ml + 6, y + 10);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
      const desc = lcData ? `${lcData.pieces?.length ?? 0} peças • LED ${lcData.led_type}` : "";
      doc.text(desc, mr - 6, y + 10, { align: "right" });
    } else {
      const fcData = (quote as any).quote_data as FachadaData | undefined;
      doc.text("FACHADA COMPLETA", ml + 6, y + 1);
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59);
      doc.text(quote.piece_name, ml + 6, y + 10);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
      const desc = fcData ? `${fcData.base_material} • ${fcData.facade_width_cm}×${fcData.facade_height_cm}cm` : "";
      doc.text(desc, mr - 6, y + 10, { align: "right" });
    }

    // ── Financial Summary ──
    y += 40;
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4); doc.line(ml, y, mr, y);
    y += 10;
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 116, 139);
    doc.text("RESUMO FINANCEIRO", ml, y);
    y += 10;

    const shippingCost = quote.shipping_cost ?? 0;
    const discount = quote.discount ?? 0;
    const basePrice = (quote.final_price ?? 0) + discount - shippingCost;

    const drawLine = (label: string, value: string, bold = false, color?: [number, number, number]) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(10); doc.setTextColor(...(color || [51, 65, 85]));
      doc.text(label, ml + 6, y);
      doc.text(value, mr - 6, y, { align: "right" });
      y += 8;
    };

    drawLine(`Valor ${qType === "3d_print" ? "da peça" : "do projeto"}`, `R$ ${basePrice.toFixed(2)}`);
    if (discount > 0) drawLine("Desconto", `- R$ ${discount.toFixed(2)}`, false, [22, 163, 74]);
    if (shippingCost > 0) drawLine("Frete", `+ R$ ${shippingCost.toFixed(2)}`);

    // ── Total ──
    y += 6;
    const totalBoxH = 36;
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(ml, y, pw - 40, totalBoxH, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    doc.text("TOTAL", pw / 2, y + 12, { align: "center" });
    doc.setFontSize(24); doc.setFont("helvetica", "bold");
    doc.text(`R$ ${(quote.final_price ?? 0).toFixed(2)}`, pw / 2, y + 27, { align: "center" });

    // ── Delivery & Payment ──
    y += totalBoxH + 14;
    doc.setTextColor(51, 65, 85); doc.setFontSize(9); doc.setFont("helvetica", "normal");
    if (quote.delivery_days) doc.text(`Prazo de entrega: ${quote.delivery_days} dias úteis`, ml, y);
    y += 7;
    if (quote.payment_method) doc.text(`Forma de pagamento: ${quote.payment_method}`, ml, y);

    // ── Footer ──
    const footerY = ph - 18;
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4); doc.line(ml, footerY - 6, mr, footerY - 6);
    doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.setFont("helvetica", "normal");
    const companyName = profile?.company_name || currentCompany?.name || "";
    const phone = profile?.company_phone || "";
    doc.text([companyName, phone].filter(Boolean).join("  •  "), pw / 2, footerY, { align: "center" });

    doc.save(`orcamento-${quote.quote_number}.pdf`);
  };

  const handleStlUpload = async (quoteId: string, file: File) => {
    const path = `${user!.id}/${quoteId}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("stl-files").upload(path, file);
    if (uploadError) { toast.error("Erro ao enviar arquivo"); return; }
    const { data: urlData } = supabase.storage.from("stl-files").getPublicUrl(path);
    await supabase.from("quotes").update({ stl_file_url: urlData.publicUrl }).eq("id", quoteId);
    qc.invalidateQueries({ queryKey: ["quotes"] });
    toast.success("Arquivo STL enviado!");
  };

  // Cost breakdown panel for the right column
  const renderCostBreakdown = () => {
    if (quoteType === "3d_print") {
      return (
        <>
          <div className="flex justify-between"><span className="text-muted-foreground">Custo Material</span><span>R$ {costs3d.material_cost.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Custo Máquina</span><span>R$ {costs3d.machine_cost.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Custo Trabalho</span><span>R$ {costs3d.labor_cost.toFixed(2)}</span></div>
          {form.has_modeling && <div className="flex justify-between"><span className="text-muted-foreground">Custo Modelagem</span><span>R$ {costs3d.modeling_cost.toFixed(2)}</span></div>}
        </>
      );
    }
    if (quoteType === "letra_caixa") {
      return (
        <>
          <div className="flex justify-between"><span className="text-muted-foreground">Materiais</span><span>R$ {costsLC.materials.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Iluminação</span><span>R$ {costsLC.illumination.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Elétrica</span><span>R$ {costsLC.electrical.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Instalação</span><span>R$ {costsLC.installation.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Acabamento</span><span>R$ {costsLC.finishing.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Produção</span><span>R$ {costsLC.production.toFixed(2)}</span></div>
        </>
      );
    }
    return (
      <>
        <div className="flex justify-between"><span className="text-muted-foreground">Base Fachada</span><span>R$ {costsFC.base.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Logo</span><span>R$ {costsFC.logo.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Letras Caixa</span><span>R$ {costsFC.letraCaixa.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Iluminação</span><span>R$ {costsFC.illumination.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Design</span><span>R$ {costsFC.design.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Instalação</span><span>R$ {costsFC.installation.toFixed(2)}</span></div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <AlertDialog open={!!approvedWarning} onOpenChange={() => setApprovedWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Orçamento Aprovado</AlertDialogTitle>
            <AlertDialogDescription>Este orçamento já foi aprovado e um pedido foi gerado. Editar pode causar inconsistências. Deseja continuar?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { fillFormForEdit(approvedWarning); setApprovedWarning(null); }}>Editar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Orçamento</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteConfirm) deleteQuote.mutate(deleteConfirm); setDeleteConfirm(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orçamentos</h1>
          {isFreePlan && (
            <p className="text-xs text-muted-foreground mt-1">
              Plano Free: {monthlyQuoteCount}/10 orçamentos este mês
              {quoteLimitReached && <span className="text-destructive font-medium ml-1">— Limite atingido</span>}
            </p>
          )}
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setEditQuoteNumber(null); setStlVolume(null); } }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} disabled={quoteLimitReached && !editId}>
              <Plus className="h-4 w-4 mr-1" /> Novo Orçamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? `Editar Orçamento #${editQuoteNumber}` : "Novo Orçamento"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
              {/* Quote Type Selector */}
              {!editId && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Tipo de Orçamento</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["3d_print", "letra_caixa", "fachada_completa"] as QuoteType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setQuoteType(t)}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          quoteType === t
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {t === "3d_print" && "🖨️ "}
                        {t === "letra_caixa" && "🔤 "}
                        {t === "fachada_completa" && "🏢 "}
                        {quoteTypeLabels[t]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column: Form fields */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Common fields: Client & Piece Name */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cliente</Label>
                      <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{quoteType === "3d_print" ? "Nome da Peça *" : "Descrição do Projeto *"}</Label>
                      <Input value={form.piece_name} onChange={(e) => setForm({ ...form, piece_name: e.target.value })} required />
                    </div>
                  </div>

                  {/* 3D Print specific */}
                  {quoteType === "3d_print" && (
                    <>
                      <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-medium flex items-center gap-2">
                                <Box className="h-4 w-4 text-primary" /> Upload de arquivo STL
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">Calcular peso e tempo automaticamente</p>
                            </div>
                            <input ref={stlInputRef} type="file" accept=".stl" className="hidden" onChange={(e) => e.target.files?.[0] && handleSTLInForm(e.target.files[0])} />
                            <Button type="button" variant="outline" size="sm" disabled={stlParsing} onClick={() => stlInputRef.current?.click()}>
                              {stlParsing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                              {stlParsing ? "Analisando..." : "Selecionar STL"}
                            </Button>
                          </div>
                          {stlVolume !== null && <p className="text-xs text-primary mt-2 font-medium">✓ Volume: {stlVolume.toFixed(2)} cm³</p>}
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Impressora</Label>
                          <Select value={form.printer_id} onValueChange={(v) => setForm({ ...form, printer_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{printers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} (R$ {p.cost_per_hour?.toFixed(2)}/h)</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Material</Label>
                          <Select value={form.material_id} onValueChange={(v) => setForm({ ...form, material_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} - {m.color}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2"><Label>Peso (g)</Label><Input type="number" min={0} step={0.1} value={form.weight_grams} onChange={(e) => setForm({ ...form, weight_grams: +e.target.value })} /></div>
                        <div className="space-y-2"><Label>Tempo Impressão (h)</Label><Input type="number" min={0} step={0.1} value={form.print_time_hours} onChange={(e) => setForm({ ...form, print_time_hours: +e.target.value })} /></div>
                        <div className="space-y-2"><Label>Pós-processamento (h)</Label><Input type="number" min={0} step={0.1} value={form.post_processing_hours} onChange={(e) => setForm({ ...form, post_processing_hours: +e.target.value })} /></div>
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
                    </>
                  )}

                  {/* Letra Caixa specific */}
                  {quoteType === "letra_caixa" && (
                    <LetraCaixaForm data={letraCaixaData} onChange={setLetraCaixaData} />
                  )}

                  {/* Fachada Completa specific */}
                  {quoteType === "fachada_completa" && (
                    <FachadaCompletaForm data={fachadaData} onChange={setFachadaData} />
                  )}

                  {/* Common: margin, discount, shipping, delivery, payment */}
                  <div className="border-t border-border pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Margem (%)</Label><Input type="number" min={0} max={500} step={1} value={form.margin * 100} onChange={(e) => setForm({ ...form, margin: +e.target.value / 100 })} /></div>
                      <div className="space-y-2"><Label>Desconto (R$)</Label><Input type="number" min={0} step={0.01} value={form.discount} onChange={(e) => setForm({ ...form, discount: +e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Frete (R$)</Label><Input type="number" min={0} step={0.01} value={form.shipping_cost} onChange={(e) => setForm({ ...form, shipping_cost: +e.target.value })} /></div>
                      <div className="space-y-2"><Label>Prazo (dias)</Label><Input type="number" min={1} value={form.delivery_days} onChange={(e) => setForm({ ...form, delivery_days: +e.target.value })} /></div>
                    </div>
                    <div className="space-y-2"><Label>Pagamento</Label><Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="PIX, cartão..." /></div>
                  </div>
                </div>

                {/* Right column: Cost breakdown */}
                <div className="space-y-4">
                  <Card className="border-primary/20 bg-card sticky top-0">
                    <CardContent className="pt-5 space-y-2 text-sm">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Detalhamento de Custos (interno)</p>
                      {renderCostBreakdown()}
                      <div className="border-t border-border pt-2 flex justify-between font-medium"><span>Custo Total</span><span>R$ {currentTotalCost.toFixed(2)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Margem ({(form.margin * 100).toFixed(0)}%)</span><span>R$ {(currentBasePrice - currentTotalCost).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Preço Base</span><span>R$ {currentBasePrice.toFixed(2)}</span></div>
                      {form.discount > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span>- R$ {form.discount.toFixed(2)}</span></div>}
                      {form.shipping_cost > 0 && <div className="flex justify-between"><span>Frete</span><span>+ R$ {form.shipping_cost.toFixed(2)}</span></div>}
                      <div className="border-t-2 border-primary/30 pt-3 flex justify-between font-bold text-lg text-primary">
                        <span>Preço Final</span><span>R$ {currentFinalPrice.toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

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
                <TableHead>Tipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-48"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum orçamento</TableCell></TableRow>
              ) : quotes.map((q) => {
                const qType = ((q as any).quote_type || "3d_print") as QuoteType;
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.quote_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {qType === "3d_print" && "🖨️"}
                        {qType === "letra_caixa" && "🔤"}
                        {qType === "fachada_completa" && "🏢"}
                        {" "}{quoteTypeLabels[qType]}
                      </Badge>
                    </TableCell>
                    <TableCell>{q.client_name}</TableCell>
                    <TableCell>{q.piece_name}</TableCell>
                    <TableCell className="font-semibold">R$ {(q.final_price ?? 0).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="secondary" className={statusColors[q.status]}>{statusLabels[q.status]}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(q)}><Pencil className="h-3.5 w-3.5" /></Button>
                        {q.status === "draft" && <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: q.id, status: "sent" })}>Enviar</Button>}
                        {q.status === "sent" && (
                          <>
                            <Button variant="ghost" size="sm" className="text-green-600" onClick={() => updateStatus.mutate({ id: q.id, status: "approved" })}>Aprovar</Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => updateStatus.mutate({ id: q.id, status: "rejected" })}>Recusar</Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => generatePDF(q)}><FileDown className="h-3.5 w-3.5" /></Button>
                        {qType === "3d_print" && (
                          <label className="cursor-pointer">
                            <input type="file" accept=".stl" className="hidden" onChange={(e) => e.target.files?.[0] && handleStlUpload(q.id, e.target.files[0])} />
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild><span><Upload className="h-3.5 w-3.5" /></span></Button>
                          </label>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(q.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
