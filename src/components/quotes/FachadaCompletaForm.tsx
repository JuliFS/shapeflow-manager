import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface FachadaData {
  // Base
  facade_width_cm: number;
  facade_height_cm: number;
  base_material: string;
  base_material_cost: number;
  metallic_structure_cost: number;
  reinforcement_cost: number;

  // Logo
  logo_type: string;
  logo_material: string;
  logo_cost: number;

  // Letras Caixa (integrado)
  letra_caixa_cost: number;

  // Iluminação Externa
  ext_light_type: string;
  ext_light_qty: number;
  ext_light_cost: number;

  // Projeto
  design_cost: number;

  // Instalação
  install_labor_cost: number;
  install_time_hours: number;
  equipment_cost: number;
  transport_cost: number;
}

export const emptyFachada: FachadaData = {
  facade_width_cm: 300,
  facade_height_cm: 100,
  base_material: "ACM",
  base_material_cost: 0,
  metallic_structure_cost: 0,
  reinforcement_cost: 0,
  logo_type: "relevo",
  logo_material: "PLA",
  logo_cost: 0,
  letra_caixa_cost: 0,
  ext_light_type: "refletor",
  ext_light_qty: 0,
  ext_light_cost: 0,
  design_cost: 0,
  install_labor_cost: 0,
  install_time_hours: 0,
  equipment_cost: 0,
  transport_cost: 0,
};

export function calcFachadaCosts(data: FachadaData) {
  const base = data.base_material_cost + data.metallic_structure_cost + data.reinforcement_cost;
  const logo = data.logo_cost;
  const letraCaixa = data.letra_caixa_cost;
  const illumination = data.ext_light_qty * data.ext_light_cost;
  const design = data.design_cost;
  const installation = data.install_labor_cost + data.equipment_cost + data.transport_cost;

  return {
    base,
    logo,
    letraCaixa,
    illumination,
    design,
    installation,
    total: base + logo + letraCaixa + illumination + design + installation,
  };
}

interface Props {
  data: FachadaData;
  onChange: (data: FachadaData) => void;
}

export function FachadaCompletaForm({ data, onChange }: Props) {
  const set = (field: keyof FachadaData, value: any) => onChange({ ...data, [field]: value });
  const num = (field: keyof FachadaData) => ({
    type: "number" as const,
    min: 0,
    step: 0.01,
    value: data[field] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(field, +e.target.value),
  });

  return (
    <Accordion type="multiple" defaultValue={["base", "logo", "letras", "iluminacao", "projeto", "instalacao"]} className="space-y-2">
      <AccordionItem value="base">
        <AccordionTrigger className="text-sm font-semibold">🏗️ Base da Fachada</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Largura (cm)</Label><Input {...num("facade_width_cm")} /></div>
            <div className="space-y-1"><Label className="text-xs">Altura (cm)</Label><Input {...num("facade_height_cm")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Material Base</Label>
              <Select value={data.base_material} onValueChange={(v) => set("base_material", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACM">ACM</SelectItem>
                  <SelectItem value="PVC">PVC</SelectItem>
                  <SelectItem value="Vidro">Vidro</SelectItem>
                  <SelectItem value="MDF">MDF</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Custo Material (R$)</Label><Input {...num("base_material_cost")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Estrutura Metálica (R$)</Label><Input {...num("metallic_structure_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Reforço (R$)</Label><Input {...num("reinforcement_cost")} /></div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="logo">
        <AccordionTrigger className="text-sm font-semibold">🎯 Logo</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={data.logo_type} onValueChange={(v) => set("logo_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevo">Relevo</SelectItem>
                  <SelectItem value="plano">Plano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Material</Label><Input value={data.logo_material} onChange={(e) => set("logo_material", e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Custo Logo (R$)</Label><Input {...num("logo_cost")} /></div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="letras">
        <AccordionTrigger className="text-sm font-semibold">🔤 Letras Caixa</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">Informe o custo total das letras caixa (use o módulo Letra Caixa para calcular).</p>
          <div className="space-y-1"><Label className="text-xs">Custo Letras Caixa (R$)</Label><Input {...num("letra_caixa_cost")} /></div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="iluminacao">
        <AccordionTrigger className="text-sm font-semibold">💡 Iluminação Externa</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={data.ext_light_type} onValueChange={(v) => set("ext_light_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="refletor">Refletor</SelectItem>
                  <SelectItem value="spot">Spot</SelectItem>
                  <SelectItem value="led">LED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Quantidade</Label><Input type="number" min={0} value={data.ext_light_qty} onChange={(e) => set("ext_light_qty", +e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Custo Unit. (R$)</Label><Input {...num("ext_light_cost")} /></div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="projeto">
        <AccordionTrigger className="text-sm font-semibold">📐 Projeto / Design</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="space-y-1"><Label className="text-xs">Custo de Design / Criação (R$)</Label><Input {...num("design_cost")} /></div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="instalacao">
        <AccordionTrigger className="text-sm font-semibold">🔧 Instalação</AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Mão de Obra (R$)</Label><Input {...num("install_labor_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Tempo (h)</Label><Input {...num("install_time_hours")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Equipamentos (R$)</Label><Input {...num("equipment_cost")} /></div>
            <div className="space-y-1"><Label className="text-xs">Transporte (R$)</Label><Input {...num("transport_cost")} /></div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
