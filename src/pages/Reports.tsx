import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileDown, Trophy } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";

export default function Reports() {
  const { user } = useAuth();
  const { currentCompanyId, currentCompany } = useCompany();

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("quotes").select("*").eq("company_id", currentCompanyId!);
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").eq("company_id", currentCompanyId!);
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

  const { data: financials = [] } = useQuery({
    queryKey: ["financials", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("financial_records").select("*").eq("company_id", currentCompanyId!);
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const { data: fixedExpenses = [] } = useQuery({
    queryKey: ["fixed_expenses", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("fixed_expenses").select("*").eq("company_id", currentCompanyId!).eq("active", true);
      return (data as any[]) ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const { data: variableExpenses = [] } = useQuery({
    queryKey: ["variable_expenses", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("variable_expenses").select("*").eq("company_id", currentCompanyId!);
      return (data as any[]) ?? [];
    },
    enabled: !!currentCompanyId,
  });

  // Profit by printer
  const printerStats = printers.map((printer) => {
    const printerQuotes = quotes.filter((q) => q.printer_id === printer.id && q.status === "approved");
    const revenue = printerQuotes.reduce((sum, q) => sum + (q.final_price ?? 0), 0);
    const cost = printerQuotes.reduce((sum, q) => sum + (q.total_cost ?? 0), 0);
    const profit = revenue - cost;
    return {
      name: printer.name,
      revenue,
      cost,
      profit,
      jobs: printerQuotes.length,
    };
  }).sort((a, b) => b.profit - a.profit);

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const monthlyIncome = financials.filter((f) => f.type === "income" && f.date >= monthStart && f.date <= monthEnd).reduce((s, f) => s + f.amount, 0);
  const monthlyFixed = fixedExpenses.reduce((s: number, f: any) => s + Number(f.monthly_amount), 0);
  const monthlyVariable = variableExpenses.filter((f: any) => f.date >= monthStart && f.date <= monthEnd).reduce((s: number, f: any) => s + Number(f.amount), 0);

  const generateMonthlyPDF = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório Financeiro Mensal", pw / 2, 25, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(format(now, "MMMM yyyy", { locale: ptBR }).toUpperCase(), pw / 2, 33, { align: "center" });
    if (currentCompany) doc.text(currentCompany.name, pw / 2, 40, { align: "center" });

    doc.setDrawColor(200);
    doc.line(20, 46, pw - 20, 46);

    let y = 58;
    const addLine = (label: string, value: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(label, 25, y);
      doc.text(value, pw - 25, y, { align: "right" });
      y += 8;
    };

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo", 25, y);
    y += 10;
    doc.setFontSize(10);

    addLine("Receita do Mês", `R$ ${monthlyIncome.toFixed(2)}`);
    addLine("Despesas Fixas", `R$ ${monthlyFixed.toFixed(2)}`);
    addLine("Despesas Variáveis", `R$ ${monthlyVariable.toFixed(2)}`);
    y += 4;
    doc.line(25, y - 4, pw - 25, y - 4);
    addLine("Lucro Bruto", `R$ ${(monthlyIncome - monthlyVariable).toFixed(2)}`, true);
    addLine("Lucro Líquido", `R$ ${(monthlyIncome - monthlyVariable - monthlyFixed).toFixed(2)}`, true);

    y += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Lucro por Impressora", 25, y);
    y += 10;
    doc.setFontSize(9);

    printerStats.forEach((p) => {
      doc.setFont("helvetica", "normal");
      doc.text(p.name, 25, y);
      doc.text(`Receita: R$ ${p.revenue.toFixed(2)}  |  Custo: R$ ${p.cost.toFixed(2)}  |  Lucro: R$ ${p.profit.toFixed(2)}`, pw - 25, y, { align: "right" });
      y += 7;
    });

    doc.save(`relatorio-${format(now, "yyyy-MM")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <Button onClick={generateMonthlyPDF}>
          <FileDown className="h-4 w-4 mr-1" /> Exportar PDF Mensal
        </Button>
      </div>

      {/* Printer profitability chart */}
      {printerStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> Lucro por Impressora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={printerStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="revenue" name="Receita" fill="hsl(220, 70%, 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" name="Custo" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Lucro" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Printer ranking table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Ranking de Impressoras</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Impressora</TableHead>
                <TableHead>Trabalhos</TableHead>
                <TableHead>Receita</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Lucro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {printerStats.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>
              ) : printerStats.map((p, i) => (
                <TableRow key={p.name}>
                  <TableCell>
                    <Badge variant="secondary" className={i === 0 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : ""}>{i + 1}º</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.jobs}</TableCell>
                  <TableCell className="text-green-600">R$ {p.revenue.toFixed(2)}</TableCell>
                  <TableCell className="text-destructive">R$ {p.cost.toFixed(2)}</TableCell>
                  <TableCell className="font-bold">{p.profit >= 0 ? "+" : ""}R$ {p.profit.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
