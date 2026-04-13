import { useRef, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { parseSTLVolume, analyzeSTL } from "@/lib/stl-parser";
import { toast } from "sonner";

export interface LetraCaixaPiece {
  id: string;
  name: string;
  weight_grams: number;
  print_time_hours: number;
  material_id: string;
  material_name: string;
  stl_volume_cm3: number | null;
  // 3D print advanced fields per piece
  printer_id: string;
  post_processing_hours: number;
  energy_kwh_rate: number;
  energy_consumption_kwh: number;
  failure_rate: number;
  labor_cost_manual: number;
}

export interface LetraCaixaData {
  project_name: string;
  pieces: LetraCaixaPiece[];

  has_modeling: boolean;
  modeling_hours: number;

  acrylic_type: string;
  acrylic_cost: number;

  led_type: string;
  led_meters: number;
  led_cost_per_meter: number;
  power_supply_type: string;
  power_supply_qty: number;
  power_supply_cost: number;

  wires_cost: number;
  connectors_cost: number;
  plugs_cost: number;

  template_cost: number;
  screws_cost: number;
  spacers_cost: number;
  labor_cost: number;
  travel_cost: number;

  painting_cost: number;
  sanding_cost: number;
  polishing_cost: number;
}

export const emptyLetraCaixa: LetraCaixaData = {
  project_name: "",
  pieces: [],
  has_modeling: false,
  modeling_hours: 0,
  acrylic_type: "Branco Leitoso",
  acrylic_cost: 0,
  led_type: "fita",
  led_meters: 0,
  led_cost_per_meter: 0,
  power_supply_type: "12V",
  power_supply_qty: 1,
  power_supply_cost: 0,
  wires_cost: 0,
  connectors_cost: 0,
  plugs_cost: 0,
  template_cost: 0,
  screws_cost: 0,
  spacers_cost: 0,
  labor_cost: 0,
  travel_cost: 0,
  painting_cost: 0,
  sanding_cost: 0,
  polishing_cost: 0,
};

function createPiece(): LetraCaixaPiece {
  return {
    id: crypto.randomUUID(),
    name: "",
    weight_grams: 0,
    print_time_hours: 0,
    material_id: "",
    material_name: "",
    stl_volume_cm3: null,
    printer_id: "",
    post_processing_hours: 0,
    energy_kwh_rate: 0.80,
    energy_consumption_kwh: 0.12,
    failure_rate: 10,
    labor_cost_manual: 0,
  };
}

export interface LetraCaixaCosts {
  printing: number;
  modeling: number;
  components: number;
  installation: number;
  finishing: number;
  total: number;
}

export interface PieceCostBreakdown {
  material_cost: number;
  machine_cost: number;
  energy_cost: number;
  labor_cost: number;
  base_cost: number;
  failure_addition: number;
  total_cost: number;
}

export function calcPieceCost(
  p: LetraCaixaPiece,
  getMaterialCostPerGram: (id: string) => number,
  getMachineRate: (printerId: string) => number,
  hourlyRate: number,
): PieceCostBreakdown {
  const material_cost = p.weight_grams * getMaterialCostPerGram(p.material_id);
  const machine_cost = p.print_time_hours * getMachineRate(p.printer_id);
  const energy_cost = p.energy_consumption_kwh * p.print_time_hours * p.energy_kwh_rate;
  const labor_cost = p.post_processing_hours * hourlyRate + p.labor_cost_manual;
  const base_cost = material_cost + machine_cost + energy_cost + labor_cost;
  const failure_addition = base_cost * (p.failure_rate / 100);
  const total_cost = base_cost + failure_addition;
  return { material_cost, machine_cost, energy_cost, labor_cost, base_cost, failure_addition, total_cost };
}

export function calcLetraCaixaCosts(
  data: LetraCaixaData,
  hourlyRate: number,
  modelingRate: number,
  getMaterialCostPerGram: (id: string) => number,
  getMachineRate: (printerId: string) => number
): LetraCaixaCosts {
  let printing = 0;
  for (const p of data.pieces) {
    const pc = calcPieceCost(p, getMaterialCostPerGram, getMachineRate, hourlyRate);
    printing += pc.total_cost;
  }

  const modeling = data.has_modeling ? data.modeling_hours * modelingRate : 0;

  const led_total = data.led_meters * data.led_cost_per_meter;
  const power_total = data.power_supply_qty * data.power_supply_cost;
  const electrical = data.wires_cost + data.connectors_cost + data.plugs_cost;
  const components = data.acrylic_cost + led_total + power_total + electrical;

  const installation = data.template_cost + data.screws_cost + data.spacers_cost + data.labor_cost + data.travel_cost;

  const finishing = data.painting_cost + data.sanding_cost + data.polishing_cost;

  const total = printing + modeling + components + installation + finishing;

  return { printing, modeling, components, installation, finishing, total };
}

const fmt = (v: number) => `R$ ${v.toFixed(2)}`;

interface Props {
  data: LetraCaixaData;
  onChange: (data: LetraCaixaData) => void;
  materials: Array<{ id: string; name: string; color: string | null; cost_per_kg: number; density: number | null }>;
  printers: Array<{ id: string; name: string; cost_per_hour: number | null }>;
}

export function LetraCaixaForm({ data, onChange, materials, printers }: Props) {
  const [parsingIdx, setParsingIdx] = useState<number | null>(null);
  const stlRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const set = (field: keyof LetraCaixaData, value: any) => onChange({ ...data, [field]: value });
  const num = (field: keyof LetraCaixaData) => ({
    type: "number" as const,
    min: 0,
    step: 0.01,
    value: data[field] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(field, +e.target.value),
  });

  const addPiece = () => {
    onChange({ ...data, pieces: [...data.pieces, createPiece()] });
  };

  const updatePiece = (idx: number, patch: Partial<LetraCaixaPiece>) => {
    const pieces = data.pieces.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onChange({ ...data, pieces });
  };

  const removePiece = (idx: number) => {
    onChange({ ...data, pieces: data.pieces.filter((_, i) => i !== idx) });
  };

  const handleSTL = async (idx: number, file: File) => {
    setParsingIdx(idx);
    try {
      const buffer = await file.arrayBuffer();
      const volumeCm3 = parseSTLVolume(buffer);
      const piece = data.pieces[idx];
      const mat = materials.find((m) => m.id === piece.material_id);
      const density = mat?.density ?? 1.24;
      const analysis = analyzeSTL(volumeCm3, density);
      updatePiece(idx, {
        weight_grams: analysis.weightGrams,
        print_time_hours: analysis.estimatedPrintTimeHours,
        stl_volume_cm3: volumeCm3,
      });
      toast.success(`STL: ${volumeCm3.toFixed(1)} cm³ — ${analysis.weightGrams}g — ~${analysis.estimatedPrintTimeHours}h`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar STL");
    } finally {
      setParsingIdx(null);
    }
  };

  const totalWeight = data.pieces.reduce((s, p) => s + p.weight_grams, 0);
  const totalTime = data.pieces.reduce((s, p) => s + p.print_time_hours, 0);

  return (
    <Accordion type="multiple" defaultValue={["projeto", "pecas", "modelagem", "iluminacao", "eletrica", "instalacao", "acabamento"]} className="space-y-2">
      {/* Projeto */}
      <AccordionItem value="projeto">
        <AccordionTrigger className="text-sm font-semibold">📋 Projeto</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Nome do Projeto</Label>
            <Input value={data.project_name} onChange={(e) => set("project_name", e.target.value)} placeholder="Ex: Fachada Loja ABC" />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Peças */}
      <AccordionItem value="pecas">
        <AccordionTrigger className="text-sm font-semibold">🔤 Peças ({data.pieces.length})</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          {data.pieces.map((piece, idx) => (
            <PieceCard
              key={piece.id}
              piece={piece}
              idx={idx}
              materials={materials}
              printers={printers}
              parsingIdx={parsingIdx}
              stlRefs={stlRefs}
              onUpdate={(patch) => updatePiece(idx, patch)}
              onRemove={() => removePiece(idx)}
              onSTL={(file) => handleSTL(idx, file)}
            />
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addPiece} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Adicionar Peça
          </Button>

          {data.pieces.length > 0 && (
            <div className="flex gap-4 text-xs text-muted-foreground pt-1">
              <span>Total: <strong>{totalWeight.toFixed(1)}g</strong></span>
              <span>Tempo: <strong>{totalTime.toFixed(1)}h</strong></span>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* Modelagem */}
      <AccordionItem value="modelagem">
        <AccordionTrigger className="text-sm font-semibold">🎨 Modelagem</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <Switch checked={data.has_modeling} onCheckedChange={(v) => set("has_modeling", v)} />
            <Label className="text-xs">Inclui modelagem 3D</Label>
          </div>
          {data.has_modeling && (
            <div className="space-y-1">
              <Label className="text-xs">Horas de Modelagem</Label>
              <Input type="number" min={0} step={0.5} value={data.modeling_hours} onChange={(e) => set("modeling_hours", +e.target.value)} />
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* Componentes */}
      <AccordionItem value="iluminacao">
        <AccordionTrigger className="text-sm font-semibold">💡 Componentes & Iluminação</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Tipo Acrílico</Label><Input value={data.acrylic_type} onChange={(e) => set("acrylic_type", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Custo Acrílico (R$)</Label><Input {...num("acrylic_cost")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo LED</Label>
              <Select value={data.led_type} onValueChange={(v) => set("led_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fita">Fita LED</SelectItem>
                  <SelectItem value="modulo">Módulo LED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Metros</Label><Input {...num("led_meters")} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Custo por metro (R$)</Label><Input {...num("led_cost_per_meter")} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Tipo Fonte</Label><Input value={data.power_supply_type} onChange={(e) => set("power_supply_type", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Qtd Fontes</Label><Input type="number" min={0} value={data.power_supply_qty} onChange={(e) => set("power_supply_qty", +e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Custo Fonte (R$)</Label><Input {...num("power_supply_cost")} /></div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Elétrica */}
      <AccordionItem value="eletrica">
        <AccordionTrigger className="text-sm font-semibold">⚡ Elétrica</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Fios (R$)</Label><Input {...num("wires_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Conectores (R$)</Label><Input {...num("connectors_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Plugues (R$)</Label><Input {...num("plugs_cost")} /></div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Instalação */}
      <AccordionItem value="instalacao">
        <AccordionTrigger className="text-sm font-semibold">🔧 Instalação</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Gabarito (R$)</Label><Input {...num("template_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Fixação (R$)</Label><Input {...num("screws_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Espaçadores (R$)</Label><Input {...num("spacers_cost")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Mão de Obra (R$)</Label><Input {...num("labor_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Deslocamento (R$)</Label><Input {...num("travel_cost")} /></div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Acabamento */}
      <AccordionItem value="acabamento">
        <AccordionTrigger className="text-sm font-semibold">✨ Acabamento</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Pintura (R$)</Label><Input {...num("painting_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Lixamento (R$)</Label><Input {...num("sanding_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Polimento (R$)</Label><Input {...num("polishing_cost")} /></div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/* ============ Per-piece card with full 3D print fields ============ */

interface PieceCardProps {
  piece: LetraCaixaPiece;
  idx: number;
  materials: Props["materials"];
  printers: Props["printers"];
  parsingIdx: number | null;
  stlRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
  onUpdate: (patch: Partial<LetraCaixaPiece>) => void;
  onRemove: () => void;
  onSTL: (file: File) => void;
}

function PieceCard({ piece, idx, materials, printers, parsingIdx, stlRefs, onUpdate, onRemove, onSTL }: PieceCardProps) {
  const selectedMat = materials.find((m) => m.id === piece.material_id);
  const selectedPrinter = printers.find((p) => p.id === piece.printer_id);
  const costPerGram = selectedMat ? selectedMat.cost_per_kg / 1000 : 0;

  const costs = useMemo((): PieceCostBreakdown => {
    const material_cost = piece.weight_grams * costPerGram;
    const machine_cost = piece.print_time_hours * (selectedPrinter?.cost_per_hour ?? 0);
    const energy_cost = piece.energy_consumption_kwh * piece.print_time_hours * piece.energy_kwh_rate;
    const labor_cost = piece.post_processing_hours * 50 + piece.labor_cost_manual; // uses default hourly rate inline
    const base_cost = material_cost + machine_cost + energy_cost + labor_cost;
    const failure_addition = base_cost * (piece.failure_rate / 100);
    const total_cost = base_cost + failure_addition;
    return { material_cost, machine_cost, energy_cost, labor_cost, base_cost, failure_addition, total_cost };
  }, [piece, costPerGram, selectedPrinter]);

  return (
    <Card className="border border-border">
      <CardContent className="pt-3 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Peça {idx + 1}</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Nome e Material */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome da Peça</Label>
            <Input value={piece.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="Ex: Letra A" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Material</Label>
            <Select value={piece.material_id} onValueChange={(v) => {
              const mat = materials.find((m) => m.id === v);
              onUpdate({ material_id: v, material_name: mat?.name ?? "" });
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}{m.color ? ` - ${m.color}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custo/kg info */}
        {selectedMat && (
          <div className="text-xs text-muted-foreground">
            Custo: R$ {selectedMat.cost_per_kg.toFixed(2)}/kg → R$ {costPerGram.toFixed(4)}/g
          </div>
        )}

        {/* STL Upload */}
        <div className="flex items-center gap-2">
          <input
            ref={(el) => { stlRefs.current[idx] = el; }}
            type="file"
            accept=".stl"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onSTL(e.target.files[0])}
          />
          <Button type="button" variant="outline" size="sm" disabled={parsingIdx === idx} onClick={() => stlRefs.current[idx]?.click()}>
            {parsingIdx === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
            {parsingIdx === idx ? "Analisando..." : "Upload STL"}
          </Button>
          {piece.stl_volume_cm3 !== null && (
            <span className="text-xs text-primary font-medium">✓ {piece.stl_volume_cm3.toFixed(1)} cm³</span>
          )}
        </div>

        {/* Peso e Tempo */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Peso (g)</Label>
            <Input type="number" min={0} step={0.1} value={piece.weight_grams} onChange={(e) => onUpdate({ weight_grams: +e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tempo Impressão (h)</Label>
            <Input type="number" min={0} step={0.1} value={piece.print_time_hours} onChange={(e) => onUpdate({ print_time_hours: +e.target.value })} />
          </div>
        </div>

        {/* Impressora */}
        <div className="space-y-1">
          <Label className="text-xs">Impressora</Label>
          <Select value={piece.printer_id} onValueChange={(v) => onUpdate({ printer_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione impressora" /></SelectTrigger>
            <SelectContent>
              {printers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} {p.cost_per_hour ? `(R$ ${p.cost_per_hour}/h)` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Energia */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Consumo (kWh)</Label>
            <Input type="number" min={0} step={0.01} value={piece.energy_consumption_kwh} onChange={(e) => onUpdate({ energy_consumption_kwh: +e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor kWh (R$)</Label>
            <Input type="number" min={0} step={0.01} value={piece.energy_kwh_rate} onChange={(e) => onUpdate({ energy_kwh_rate: +e.target.value })} />
          </div>
        </div>

        {/* Taxa de falha e Pós-processamento */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Taxa de Falha (%)</Label>
            <Input type="number" min={0} max={100} step={1} value={piece.failure_rate} onChange={(e) => onUpdate({ failure_rate: +e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Pós-Processamento (h)</Label>
            <Input type="number" min={0} step={0.1} value={piece.post_processing_hours} onChange={(e) => onUpdate({ post_processing_hours: +e.target.value })} />
          </div>
        </div>

        {/* Mão de Obra Manual */}
        <div className="space-y-1">
          <Label className="text-xs">Mão de Obra Manual (R$)</Label>
          <Input type="number" min={0} step={0.01} value={piece.labor_cost_manual} onChange={(e) => onUpdate({ labor_cost_manual: +e.target.value })} />
        </div>

        {/* Breakdown de custo */}
        <div className="bg-muted/50 rounded-md p-2 space-y-1 text-xs">
          <div className="font-semibold text-foreground mb-1">Custo da Peça</div>
          <div className="flex justify-between"><span>Material</span><span>{fmt(costs.material_cost)}</span></div>
          <div className="flex justify-between"><span>Máquina</span><span>{fmt(costs.machine_cost)}</span></div>
          <div className="flex justify-between"><span>Energia</span><span>{fmt(costs.energy_cost)}</span></div>
          <div className="flex justify-between"><span>Mão de Obra</span><span>{fmt(costs.labor_cost)}</span></div>
          <div className="flex justify-between border-t border-border pt-1"><span>Base</span><span>{fmt(costs.base_cost)}</span></div>
          <div className="flex justify-between text-orange-600"><span>+ Falha ({piece.failure_rate}%)</span><span>{fmt(costs.failure_addition)}</span></div>
          <div className="flex justify-between font-bold border-t border-border pt-1"><span>Total Peça</span><span>{fmt(costs.total_cost)}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}
