import { useRef, useState } from "react";
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
}

export interface LetraCaixaData {
  // Projeto
  project_name: string;
  pieces: LetraCaixaPiece[];

  // Modelagem
  has_modeling: boolean;
  modeling_hours: number;

  // Acrílico
  acrylic_type: string;
  acrylic_cost: number;

  // Iluminação
  led_type: string;
  led_meters: number;
  led_cost_per_meter: number;
  power_supply_type: string;
  power_supply_qty: number;
  power_supply_cost: number;

  // Elétrica
  wires_cost: number;
  connectors_cost: number;
  plugs_cost: number;

  // Instalação
  template_cost: number;
  screws_cost: number;
  spacers_cost: number;
  labor_cost: number;
  travel_cost: number;

  // Acabamento
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

export function calcLetraCaixaCosts(
  data: LetraCaixaData,
  hourlyRate: number,
  modelingRate: number,
  getMaterialCostPerGram: (id: string) => number,
  getMachineRate: () => number
): LetraCaixaCosts {
  // Printing costs per piece
  let printing = 0;
  for (const p of data.pieces) {
    const materialCost = p.weight_grams * getMaterialCostPerGram(p.material_id);
    const machineCost = p.print_time_hours * getMachineRate();
    const laborCost = p.print_time_hours * hourlyRate * 0.1; // 10% of print time as labor overhead
    printing += materialCost + machineCost + laborCost;
  }

  // Modeling
  const modeling = data.has_modeling ? data.modeling_hours * modelingRate : 0;

  // Components: acrylic + LED + power + electrical
  const led_total = data.led_meters * data.led_cost_per_meter;
  const power_total = data.power_supply_qty * data.power_supply_cost;
  const electrical = data.wires_cost + data.connectors_cost + data.plugs_cost;
  const components = data.acrylic_cost + led_total + power_total + electrical;

  // Installation
  const installation = data.template_cost + data.screws_cost + data.spacers_cost + data.labor_cost + data.travel_cost;

  // Finishing
  const finishing = data.painting_cost + data.sanding_cost + data.polishing_cost;

  const total = printing + modeling + components + installation + finishing;

  return { printing, modeling, components, installation, finishing, total };
}

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
            <Card key={piece.id} className="border border-border">
              <CardContent className="pt-3 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Peça {idx + 1}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePiece(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome da Peça</Label>
                    <Input value={piece.name} onChange={(e) => updatePiece(idx, { name: e.target.value })} placeholder="Ex: Letra A" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Material</Label>
                    <Select value={piece.material_id} onValueChange={(v) => {
                      const mat = materials.find((m) => m.id === v);
                      updatePiece(idx, { material_id: v, material_name: mat?.name ?? "" });
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

                {/* STL Upload */}
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => { stlRefs.current[idx] = el; }}
                    type="file"
                    accept=".stl"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleSTL(idx, e.target.files[0])}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={parsingIdx === idx} onClick={() => stlRefs.current[idx]?.click()}>
                    {parsingIdx === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                    {parsingIdx === idx ? "Analisando..." : "Upload STL"}
                  </Button>
                  {piece.stl_volume_cm3 !== null && (
                    <span className="text-xs text-primary font-medium">✓ {piece.stl_volume_cm3.toFixed(1)} cm³</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Peso (g)</Label>
                    <Input type="number" min={0} step={0.1} value={piece.weight_grams} onChange={(e) => updatePiece(idx, { weight_grams: +e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tempo Impressão (h)</Label>
                    <Input type="number" min={0} step={0.1} value={piece.print_time_hours} onChange={(e) => updatePiece(idx, { print_time_hours: +e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>
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
