import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface LetraCaixaData {
  // Estrutura
  letter_count: number;
  letter_height_cm: number;
  letter_depth_cm: number;
  structure_material: string;
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
  electrical_total: number;

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

  // Produção
  print_time_hours: number;
  assembly_time_hours: number;
  electrical_time_hours: number;
}

export const emptyLetraCaixa: LetraCaixaData = {
  letter_count: 1,
  letter_height_cm: 20,
  letter_depth_cm: 5,
  structure_material: "PLA",
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
  electrical_total: 0,
  template_cost: 0,
  screws_cost: 0,
  spacers_cost: 0,
  labor_cost: 0,
  travel_cost: 0,
  painting_cost: 0,
  sanding_cost: 0,
  polishing_cost: 0,
  print_time_hours: 0,
  assembly_time_hours: 0,
  electrical_time_hours: 0,
};

export function calcLetraCaixaCosts(data: LetraCaixaData, hourlyRate: number) {
  const led_total = data.led_meters * data.led_cost_per_meter;
  const power_total = data.power_supply_qty * data.power_supply_cost;
  const electrical = data.wires_cost + data.connectors_cost + data.plugs_cost;
  const installation = data.template_cost + data.screws_cost + data.spacers_cost + data.labor_cost + data.travel_cost;
  const finishing = data.painting_cost + data.sanding_cost + data.polishing_cost;
  const production = (data.print_time_hours + data.assembly_time_hours + data.electrical_time_hours) * hourlyRate;

  const materials = data.acrylic_cost;
  const illumination = led_total + power_total;

  return {
    materials,
    illumination,
    electrical,
    installation,
    finishing,
    production,
    total: materials + illumination + electrical + installation + finishing + production,
  };
}

interface Props {
  data: LetraCaixaData;
  onChange: (data: LetraCaixaData) => void;
}

export function LetraCaixaForm({ data, onChange }: Props) {
  const set = (field: keyof LetraCaixaData, value: any) => onChange({ ...data, [field]: value });
  const num = (field: keyof LetraCaixaData) => ({
    type: "number" as const,
    min: 0,
    step: 0.01,
    value: data[field] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(field, +e.target.value),
  });

  return (
    <Accordion type="multiple" defaultValue={["estrutura", "iluminacao", "eletrica", "instalacao", "acabamento", "producao"]} className="space-y-2">
      <AccordionItem value="estrutura">
        <AccordionTrigger className="text-sm font-semibold">🔤 Estrutura</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Qtd Letras</Label><Input type="number" min={1} value={data.letter_count} onChange={(e) => set("letter_count", +e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Altura (cm)</Label><Input {...num("letter_height_cm")} /></div>
            <div className="space-y-1"><Label className="text-xs">Profundidade (cm)</Label><Input {...num("letter_depth_cm")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Material Estrutura</Label>
              <Select value={data.structure_material} onValueChange={(v) => set("structure_material", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLA">PLA</SelectItem>
                  <SelectItem value="ABS">ABS</SelectItem>
                  <SelectItem value="PETG">PETG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Tipo Acrílico</Label><Input value={data.acrylic_type} onChange={(e) => set("acrylic_type", e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Custo Acrílico (R$)</Label><Input {...num("acrylic_cost")} /></div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="iluminacao">
        <AccordionTrigger className="text-sm font-semibold">💡 Iluminação</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
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

      <AccordionItem value="instalacao">
        <AccordionTrigger className="text-sm font-semibold">🔧 Instalação</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Gabarito (R$)</Label><Input {...num("template_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Parafusos/Buchas (R$)</Label><Input {...num("screws_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Espaçadores (R$)</Label><Input {...num("spacers_cost")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Mão de Obra (R$)</Label><Input {...num("labor_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Deslocamento (R$)</Label><Input {...num("travel_cost")} /></div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="acabamento">
        <AccordionTrigger className="text-sm font-semibold">🎨 Acabamento</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Pintura (R$)</Label><Input {...num("painting_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Lixamento (R$)</Label><Input {...num("sanding_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Polimento (R$)</Label><Input {...num("polishing_cost")} /></div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="producao">
        <AccordionTrigger className="text-sm font-semibold">⏱️ Produção (horas)</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Impressão (h)</Label><Input {...num("print_time_hours")} /></div>
            <div className="space-y-1"><Label className="text-xs">Montagem (h)</Label><Input {...num("assembly_time_hours")} /></div>
            <div className="space-y-1"><Label className="text-xs">Elétrica (h)</Label><Input {...num("electrical_time_hours")} /></div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
