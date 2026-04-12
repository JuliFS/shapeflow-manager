import { useState, useMemo, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, FileDown, Upload, Pencil, Trash2, Loader2, Box, AlertTriangle } from "lucide-react";
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

type Complexity = "simples" | "medio" | "complexo";
const complexityMultipliers: Record<Complexity, number> = { simples: 1, medio: 1.5, complexo: 2 };


const emptyForm = {
  client_id: "", piece_name: "", printer_id: "", material_id: "",
  weight_grams: 0, print_time_hours: 0, finishing: "", post_processing_hours: 0,
  has_modeling: false, modeling_hours: 0, margin: 0.3, delivery_days: 7,
  payment_method: "", shipping_cost: 0, discount: 0, validity_days: 15,
  observations: "",
  // 3D print advanced fields
  energy_kwh_rate: 0.80,
  energy_consumption_kwh: 0.12,
  failure_rate: 10,
  labor_cost_manual: 0,
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
  const [complexity, setComplexity] = useState<Complexity>("simples");
  const [manualMarkup, setManualMarkup] = useState(false);

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

  const { data: pricingConfig } = useQuery({
    queryKey: ["pricing_config", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("pricing_config").select("*").eq("company_id", currentCompanyId!).maybeSingle();
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

  // Auto-markup helpers
  const getBaseMarkup = (type: QuoteType): number => {
    if (!pricingConfig) {
      return type === "3d_print" ? 100 : type === "letra_caixa" ? 200 : 300;
    }
    const map: Record<QuoteType, string> = { "3d_print": "markup_3d_print", "letra_caixa": "markup_letra_caixa", "fachada_completa": "markup_fachada_completa" };
    return Number((pricingConfig as any)[map[type]]) || 100;
  };

  const getEffectiveMarkup = (type: QuoteType, comp: Complexity): number => {
    const base = getBaseMarkup(type);
    return base * complexityMultipliers[comp];
  };

  const minProfitPercent = pricingConfig ? Number((pricingConfig as any).min_profit_percent) : 30;

  // Profit protection check
  const profitInfo = useMemo(() => {
    // profit = margin/(1+margin) as percentage of final price
    const actualProfitPct = (form.margin / (1 + form.margin)) * 100;
    const belowMin = actualProfitPct < minProfitPercent;
    // Suggested margin to meet min profit: minProfit/(100-minProfit)
    const suggestedMargin = minProfitPercent / (100 - minProfitPercent);
    return { actualProfitPct, belowMin, suggestedMarkup: suggestedMargin * 100 };
  }, [form.margin, minProfitPercent]);

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
    const energy_cost = form.energy_consumption_kwh * form.print_time_hours * form.energy_kwh_rate;
    const labor_cost = form.post_processing_hours * hourlyRate + form.labor_cost_manual;
    const modeling_cost = form.has_modeling ? form.modeling_hours * modelingRate : 0;
    const base_cost = material_cost + machine_cost + energy_cost + labor_cost + modeling_cost;
    const total_cost = base_cost * (1 + form.failure_rate / 100);
    const base_price = total_cost * (1 + form.margin);
    const final_price = base_price - form.discount + form.shipping_cost;

    return { material_cost, machine_cost, energy_cost, labor_cost, modeling_cost, base_cost, total_cost, base_price, final_price };
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
          quote_data: { validity_days: form.validity_days, observations: form.observations, complexity },
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
          quote_data: { ...letraCaixaData, validity_days: form.validity_days, observations: form.observations, complexity },
        });
      } else {
        Object.assign(basePayload, {
          material_name: fachadaData.base_material,
          weight_grams: 0,
          print_time_hours: 0,
          total_cost: costsFC.total,
          base_price: costsFC.base_price,
          final_price: costsFC.final_price,
          quote_data: { ...fachadaData, validity_days: form.validity_days, observations: form.observations, complexity },
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
      discount: q.discount ?? 0, validity_days: (q.quote_data as any)?.validity_days ?? 15,
      observations: (q.quote_data as any)?.observations ?? "",
      energy_kwh_rate: (q.quote_data as any)?.energy_kwh_rate ?? 0.80,
      energy_consumption_kwh: (q.quote_data as any)?.energy_consumption_kwh ?? 0.12,
      failure_rate: (q.quote_data as any)?.failure_rate ?? 10,
      labor_cost_manual: (q.quote_data as any)?.labor_cost_manual ?? 0,
    });
    const type = (q.quote_type || "3d_print") as QuoteType;
    setQuoteType(type);
    setComplexity(((q.quote_data as any)?.complexity as Complexity) || "simples");
    setManualMarkup(true); // preserve existing margin on edit
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
    const defaultMarkup = getBaseMarkup("3d_print");
    setForm({ ...emptyForm, margin: defaultMarkup / 100 });
    setQuoteType("3d_print");
    setComplexity("simples");
    setManualMarkup(false);
    setLetraCaixaData({ ...emptyLetraCaixa });
    setFachadaData({ ...emptyFachada });
    setEditId(null);
    setEditQuoteNumber(null);
    setStlVolume(null);
    setOpen(true);
  };

  const handleQuoteTypeChange = (t: QuoteType) => {
    setQuoteType(t);
    if (!manualMarkup) {
      const markup = getEffectiveMarkup(t, complexity);
      setForm((prev) => ({ ...prev, margin: markup / 100 }));
    }
  };

  const handleComplexityChange = (c: Complexity) => {
    setComplexity(c);
    if (!manualMarkup) {
      const markup = getEffectiveMarkup(quoteType, c);
      setForm((prev) => ({ ...prev, margin: markup / 100 }));
    }
  };

  const handleManualMarginChange = (value: number) => {
    setManualMarkup(true);
    setForm((prev) => ({ ...prev, margin: value / 100 }));
  };

  const generatePDF = async (quote: typeof quotes[0]) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ml = 20;
    const mr = pw - 20;
    const contentW = mr - ml;
    const qType = ((quote as any).quote_type || "3d_print") as QuoteType;

    // ── Helpers ──
    const drawFooter = () => {
      const footerY = ph - 14;
      doc.setDrawColor(200, 210, 220);
      doc.setLineWidth(0.3);
      doc.line(ml, footerY - 4, mr, footerY - 4);
      doc.setFontSize(7);
      doc.setTextColor(140, 150, 165);
      doc.setFont("helvetica", "normal");
      const companyName = profile?.company_name || currentCompany?.name || "";
      const phone = profile?.company_phone || "";
      doc.text([companyName, phone].filter(Boolean).join("  •  "), pw / 2, footerY, { align: "center" });
    };

    const checkPageBreak = (needed: number) => {
      if (y + needed > ph - 30) {
        drawFooter();
        doc.addPage();
        y = 20;
      }
    };

    // ── Load logo ──
    let logoImg: HTMLImageElement | null = null;
    if (profile?.company_logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = profile.company_logo_url!;
        });
        logoImg = img;
      } catch { /* skip */ }
    }

    // ════════════════════════════════════════
    // HEADER
    // ════════════════════════════════════════
    let headerBottomY = 14;
    if (logoImg) {
      doc.addImage(logoImg, "PNG", ml, 12, 24, 24);
    }
    const headerX = logoImg ? ml + 30 : ml;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(profile?.company_name || currentCompany?.name || "Empresa", headerX, 22);
    let subY = 28;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 130, 145);
    if (profile?.company_phone) { doc.text(profile.company_phone, headerX, subY); subY += 5; }
    if (profile?.company_address) { doc.text(profile.company_address, headerX, subY); subY += 5; }
    headerBottomY = Math.max(subY, logoImg ? 38 : subY);

    // Right side: title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text("ORÇAMENTO", mr, 22, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 130, 145);
    doc.text(`Nº ${quote.quote_number}`, mr, 29, { align: "right" });
    doc.text(`Data: ${format(new Date(quote.created_at), "dd/MM/yyyy")}`, mr, 35, { align: "right" });

    // Divider
    let y = headerBottomY + 4;
    doc.setDrawColor(210, 218, 228);
    doc.setLineWidth(0.6);
    doc.line(ml, y, mr, y);

    // ════════════════════════════════════════
    // CLIENT
    // ════════════════════════════════════════
    y += 10;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(140, 150, 165);
    doc.text("CLIENTE", ml, y);
    y += 6;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(quote.client_name || "—", ml, y);
    const client = clients.find(c => c.id === quote.client_id);
    if (client?.cpf) {
      y += 5;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`CPF: ${client.cpf}`, ml, y);
    }

    // ════════════════════════════════════════
    // PROJECT INFO
    // ════════════════════════════════════════
    y += 12;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(140, 150, 165);
    doc.text("PROJETO", ml, y);
    y += 6;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);

    let projectName = quote.piece_name;
    let projectType = quoteTypeLabels[qType];
    

    if (qType === "letra_caixa") {
      const lcData = (quote as any).quote_data as LetraCaixaData | undefined;
      projectName = lcData?.project_name || quote.piece_name;
    } else if (qType === "fachada_completa") {
    }

    doc.text(projectName, ml, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 90, 105);
    doc.text(`Tipo: ${projectType}`, ml, y);

    // ════════════════════════════════════════
    // DETAILED ITEMS TABLE
    // ════════════════════════════════════════
    y += 14;
    doc.setDrawColor(210, 218, 228);
    doc.setLineWidth(0.3);
    doc.line(ml, y, mr, y);
    y += 8;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(140, 150, 165);
    doc.text("DESCRIÇÃO DOS SERVIÇOS", ml, y);
    y += 8;

    // Table header
    doc.setFillColor(245, 247, 250);
    doc.rect(ml, y - 4, contentW, 8, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 90, 105);
    doc.text("Item", ml + 4, y);
    doc.text("Descrição", ml + 60, y);
    doc.text("Valor", mr - 4, y, { align: "right" });
    y += 8;

    // Build items list based on quote type (sale values, not internal costs)
    const margin = quote.margin ?? 0.3;
    const applyMargin = (cost: number) => cost * (1 + margin);

    type PdfItem = { name: string; desc: string; value: number };
    const items: PdfItem[] = [];

    if (qType === "3d_print") {
      const totalCost = quote.total_cost ?? 0;
      items.push({ name: "Impressão 3D", desc: `${quote.piece_name} — ${quote.material_name || ""}`, value: applyMargin(totalCost) });
    } else if (qType === "letra_caixa") {
      const lcData = (quote as any).quote_data as LetraCaixaData | undefined;
      if (lcData) {
        const hourlyRate = profile?.hourly_rate ?? 50;
        const modelingRate = profile?.modeling_hourly_rate ?? 80;
        const getMaterialCost = (id: string) => { const m = materials.find(mat => mat.id === id); return m ? m.cost_per_kg / 1000 : 0; };
        const getMachineRate = () => printers[0]?.cost_per_hour ?? 0;
        const c = calcLetraCaixaCosts(lcData, hourlyRate, modelingRate, getMaterialCost, getMachineRate);
        if (c.printing > 0) items.push({ name: "Estrutura em impressão 3D", desc: `${lcData.pieces?.length ?? 0} peças`, value: applyMargin(c.printing) });
        if (c.modeling > 0) items.push({ name: "Modelagem 3D", desc: `${lcData.modeling_hours}h de projeto`, value: applyMargin(c.modeling) });
        if (c.components > 0) {
          const compParts: string[] = [];
          if (lcData.acrylic_cost > 0) compParts.push("acrílico");
          if (lcData.led_meters > 0) compParts.push(`LED ${lcData.led_type}`);
          if (lcData.power_supply_qty > 0) compParts.push("fonte");
          items.push({ name: "Componentes", desc: compParts.join(", ") || "componentes diversos", value: applyMargin(c.components) });
        }
        if (c.installation > 0) items.push({ name: "Instalação", desc: "fixação, gabarito e deslocamento", value: applyMargin(c.installation) });
        if (c.finishing > 0) items.push({ name: "Acabamento", desc: "pintura, lixamento e polimento", value: applyMargin(c.finishing) });
      }
    } else {
      const fcData = (quote as any).quote_data as FachadaData | undefined;
      if (fcData) {
        const c = calcFachadaCosts(fcData);
        if (c.base > 0) items.push({ name: "Base da fachada", desc: `${fcData.base_material} — ${fcData.facade_width_cm}×${fcData.facade_height_cm}cm`, value: applyMargin(c.base) });
        if (c.logo > 0) items.push({ name: "Logo", desc: `${fcData.logo_type} — ${fcData.logo_material}`, value: applyMargin(c.logo) });
        if (c.letraCaixa > 0) items.push({ name: "Letras Caixa", desc: "conjunto de letras caixa", value: applyMargin(c.letraCaixa) });
        if (c.illumination > 0) items.push({ name: "Iluminação externa", desc: `${fcData.ext_light_qty}x ${fcData.ext_light_type}`, value: applyMargin(c.illumination) });
        if (c.design > 0) items.push({ name: "Projeto / Design", desc: "criação visual", value: applyMargin(c.design) });
        if (c.installation > 0) items.push({ name: "Instalação", desc: "mão de obra, equipamentos e transporte", value: applyMargin(c.installation) });
      }
    }

    // Draw items
    let subtotal = 0;
    items.forEach((item, i) => {
      checkPageBreak(12);
      // Alternating background
      if (i % 2 === 0) {
        doc.setFillColor(252, 253, 254);
        doc.rect(ml, y - 4, contentW, 10, "F");
      }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 50, 65);
      doc.text(item.name, ml + 4, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 110, 125);
      // Truncate desc if too long
      const maxDescW = 60;
      let descText = item.desc;
      while (doc.getTextWidth(descText) > maxDescW && descText.length > 3) {
        descText = descText.slice(0, -4) + "...";
      }
      doc.text(descText, ml + 60, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 50, 65);
      doc.text(`R$ ${item.value.toFixed(2)}`, mr - 4, y, { align: "right" });
      subtotal += item.value;
      y += 10;
    });

    // Items bottom line
    doc.setDrawColor(210, 218, 228);
    doc.setLineWidth(0.3);
    doc.line(ml, y - 2, mr, y - 2);

    // ════════════════════════════════════════
    // FINANCIAL SUMMARY
    // ════════════════════════════════════════
    y += 8;
    checkPageBreak(60);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(140, 150, 165);
    doc.text("RESUMO FINANCEIRO", ml, y);
    y += 10;

    const shippingCost = quote.shipping_cost ?? 0;
    const discount = quote.discount ?? 0;

    const drawSummaryLine = (label: string, value: string, bold = false, color?: [number, number, number]) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(10);
      doc.setTextColor(...(color || [51, 65, 85]));
      doc.text(label, ml + 4, y);
      doc.text(value, mr - 4, y, { align: "right" });
      y += 8;
    };

    drawSummaryLine("Subtotal dos itens", `R$ ${subtotal.toFixed(2)}`);
    if (discount > 0) drawSummaryLine("Desconto", `- R$ ${discount.toFixed(2)}`, false, [22, 163, 74]);
    if (shippingCost > 0) drawSummaryLine("Frete", `+ R$ ${shippingCost.toFixed(2)}`);

    // ════════════════════════════════════════
    // TOTAL HIGHLIGHT
    // ════════════════════════════════════════
    y += 4;
    checkPageBreak(42);
    const totalBoxH = 32;
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(ml, y, contentW, totalBoxH, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("TOTAL FINAL", pw / 2, y + 11, { align: "center" });
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(`R$ ${(quote.final_price ?? 0).toFixed(2)}`, pw / 2, y + 25, { align: "center" });

    // ════════════════════════════════════════
    // DELIVERY & PAYMENT
    // ════════════════════════════════════════
    y += totalBoxH + 12;
    checkPageBreak(20);
    doc.setFontSize(9);
    doc.setTextColor(80, 90, 105);
    doc.setFont("helvetica", "normal");
    if (quote.delivery_days) { doc.text(`Prazo de entrega: ${quote.delivery_days} dias úteis`, ml, y); y += 6; }
    if (quote.payment_method) { doc.text(`Forma de pagamento: ${quote.payment_method}`, ml, y); y += 6; }
    const validityDays = (quote.quote_data as any)?.validity_days;
    if (validityDays) { doc.text(`Validade do orçamento: ${validityDays} dias`, ml, y); y += 6; }

    // ════════════════════════════════════════
    // OBSERVATIONS / NOTES
    // ════════════════════════════════════════
    const observations = (quote.quote_data as any)?.observations || "";
    y += 6;
    checkPageBreak(30);
    doc.setDrawColor(210, 218, 228);
    doc.setLineWidth(0.2);
    doc.line(ml, y, mr, y);
    y += 8;

    if (observations) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(140, 150, 165);
      doc.text("OBSERVAÇÕES", ml, y);
      y += 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 90, 105);
      const obsLines = doc.splitTextToSize(observations, contentW);
      obsLines.forEach((line: string) => {
        checkPageBreak(6);
        doc.text(line, ml, y);
        y += 5;
      });
      y += 4;
    }

    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(140, 150, 165);
    doc.text("Não estão inclusos itens não especificados neste orçamento.", ml, y);

    // ════════════════════════════════════════
    // FOOTER
    // ════════════════════════════════════════
    drawFooter();

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
          <div className="flex justify-between"><span className="text-muted-foreground">Impressão</span><span>R$ {costsLC.printing.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Modelagem</span><span>R$ {costsLC.modeling.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Componentes</span><span>R$ {costsLC.components.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Instalação</span><span>R$ {costsLC.installation.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Acabamento</span><span>R$ {costsLC.finishing.toFixed(2)}</span></div>
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
                        onClick={() => handleQuoteTypeChange(t)}
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
                          <Label>Material (Filamento)</Label>
                          <Select value={form.material_id} onValueChange={(v) => setForm({ ...form, material_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}{m.color ? ` - ${m.color}` : ""} (R$ {m.cost_per_kg.toFixed(2)}/kg)</SelectItem>)}</SelectContent>
                          </Select>
                          {selectedMaterial && (
                            <p className="text-xs text-muted-foreground">
                              Custo: R$ {selectedMaterial.cost_per_kg.toFixed(2)}/kg → R$ {(selectedMaterial.cost_per_kg / 1000).toFixed(4)}/g
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2"><Label>Peso (g)</Label><Input type="number" min={0} step={0.1} value={form.weight_grams} onChange={(e) => setForm({ ...form, weight_grams: +e.target.value })} /></div>
                        <div className="space-y-2"><Label>Tempo Impressão (h)</Label><Input type="number" min={0} step={0.1} value={form.print_time_hours} onChange={(e) => setForm({ ...form, print_time_hours: +e.target.value })} /></div>
                        <div className="space-y-2"><Label>Pós-processamento (h)</Label><Input type="number" min={0} step={0.1} value={form.post_processing_hours} onChange={(e) => setForm({ ...form, post_processing_hours: +e.target.value })} /></div>
                      </div>

                      {/* Energy */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Consumo médio (kWh)</Label>
                          <Input type="number" min={0} step={0.01} value={form.energy_consumption_kwh} onChange={(e) => setForm({ ...form, energy_consumption_kwh: +e.target.value })} />
                          <p className="text-xs text-muted-foreground">Padrão: 0.12 kWh</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Valor do kWh (R$)</Label>
                          <Input type="number" min={0} step={0.01} value={form.energy_kwh_rate} onChange={(e) => setForm({ ...form, energy_kwh_rate: +e.target.value })} />
                        </div>
                      </div>

                      {/* Failure rate & Manual labor */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Taxa de Falha (%)</Label>
                          <Input type="number" min={0} max={100} step={1} value={form.failure_rate} onChange={(e) => setForm({ ...form, failure_rate: +e.target.value })} />
                          <p className="text-xs text-muted-foreground">Padrão: 10%. Aplicado ao custo base.</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Mão de Obra Manual (R$)</Label>
                          <Input type="number" min={0} step={0.01} value={form.labor_cost_manual} onChange={(e) => setForm({ ...form, labor_cost_manual: +e.target.value })} />
                          <p className="text-xs text-muted-foreground">Custo extra por peça</p>
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
                    </>
                  )}

                  {/* Letra Caixa specific */}
                  {quoteType === "letra_caixa" && (
                    <LetraCaixaForm data={letraCaixaData} onChange={setLetraCaixaData} materials={materials} printers={printers} />
                  )}

                  {/* Fachada Completa specific */}
                  {quoteType === "fachada_completa" && (
                    <FachadaCompletaForm data={fachadaData} onChange={setFachadaData} />
                  )}

                  {/* Common: complexity, margin, discount, shipping, delivery, payment */}
                  <div className="border-t border-border pt-4 space-y-4">
                    {/* Complexity selector */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Complexidade do Projeto</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["simples", "medio", "complexo"] as Complexity[]).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleComplexityChange(c)}
                            className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                              complexity === c
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            {c === "simples" && "⚡ Simples"}
                            {c === "medio" && "⚙️ Médio"}
                            {c === "complexo" && "🔧 Complexo"}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Markup automático: {getEffectiveMarkup(quoteType, complexity).toFixed(0)}% (base {getBaseMarkup(quoteType)}% × {complexityMultipliers[complexity]}x)
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Markup (%) {manualMarkup && <span className="text-xs text-amber-500 ml-1">✏️ manual</span>}</Label>
                        <Input type="number" min={0} max={1000} step={1} value={(form.margin * 100).toFixed(0)} onChange={(e) => handleManualMarginChange(+e.target.value)} />
                        {manualMarkup && (
                          <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setManualMarkup(false); setForm((prev) => ({ ...prev, margin: getEffectiveMarkup(quoteType, complexity) / 100 })); }}>
                            ↩ Restaurar automático
                          </button>
                        )}
                      </div>
                      <div className="space-y-2"><Label>Desconto (R$)</Label><Input type="number" min={0} step={0.01} value={form.discount} onChange={(e) => setForm({ ...form, discount: +e.target.value })} /></div>
                    </div>

                    {/* Profit protection alert */}
                    {profitInfo.belowMin && currentTotalCost > 0 && (
                      <div className="rounded-lg border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" /> Lucro abaixo do mínimo!
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-300">
                          Lucro estimado: {profitInfo.actualProfitPct.toFixed(1)}% (mínimo: {minProfitPercent}%)
                        </p>
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={() => { setManualMarkup(false); setForm((prev) => ({ ...prev, margin: profitInfo.suggestedMarkup / 100 })); }}
                        >
                          Aplicar markup sugerido: {profitInfo.suggestedMarkup.toFixed(0)}%
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Frete (R$)</Label><Input type="number" min={0} step={0.01} value={form.shipping_cost} onChange={(e) => setForm({ ...form, shipping_cost: +e.target.value })} /></div>
                      <div className="space-y-2"><Label>Prazo (dias)</Label><Input type="number" min={1} value={form.delivery_days} onChange={(e) => setForm({ ...form, delivery_days: +e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Validade (dias)</Label><Input type="number" min={1} value={form.validity_days} onChange={(e) => setForm({ ...form, validity_days: +e.target.value })} /></div>
                      <div className="space-y-2"><Label>Pagamento</Label><Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="PIX, cartão..." /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Observações</Label>
                      <Textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} placeholder="Condições comerciais, informações adicionais..." rows={3} />
                    </div>
                  </div>
                </div>

                {/* Right column: Cost breakdown */}
                <div className="space-y-4">
                  <Card className="border-primary/20 bg-card sticky top-0">
                    <CardContent className="pt-5 space-y-2 text-sm">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Detalhamento de Custos (interno)</p>
                      {renderCostBreakdown()}
                      <div className="border-t border-border pt-2 flex justify-between font-medium"><span>Custo Total</span><span>R$ {currentTotalCost.toFixed(2)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Markup ({(form.margin * 100).toFixed(0)}%)</span><span>R$ {(currentBasePrice - currentTotalCost).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Preço Base</span><span>R$ {currentBasePrice.toFixed(2)}</span></div>
                      {form.discount > 0 && <div className="flex justify-between text-green-600 dark:text-green-400"><span>Desconto</span><span>- R$ {form.discount.toFixed(2)}</span></div>}
                      {form.shipping_cost > 0 && <div className="flex justify-between"><span>Frete</span><span>+ R$ {form.shipping_cost.toFixed(2)}</span></div>}
                      <div className="border-t border-border pt-2 flex justify-between font-medium text-muted-foreground">
                        <span>Lucro estimado</span>
                        <span className={profitInfo.belowMin && currentTotalCost > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : ""}>
                          {profitInfo.actualProfitPct.toFixed(1)}%
                        </span>
                      </div>
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
