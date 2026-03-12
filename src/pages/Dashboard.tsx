import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Package, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: orders } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: quotes } = useQuery({
    queryKey: ["quotes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("quotes").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: financials } = useQuery({
    queryKey: ["financials", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("financial_records").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const monthlyIncome = (financials ?? [])
    .filter((f) => f.type === "income" && f.date >= monthStart && f.date <= monthEnd)
    .reduce((sum, f) => sum + f.amount, 0);

  const monthlyExpense = (financials ?? [])
    .filter((f) => f.type === "expense" && f.date >= monthStart && f.date <= monthEnd)
    .reduce((sum, f) => sum + f.amount, 0);

  const monthlyProfit = monthlyIncome - monthlyExpense;

  const ordersInProduction = (orders ?? []).filter(
    (o) => o.status === "printing" || o.status === "post_processing" || o.status === "queue"
  ).length;

  const pendingQuotes = (quotes ?? []).filter((q) => q.status === "draft" || q.status === "sent").length;

  // Build chart data for last 6 months
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const ms = format(startOfMonth(d), "yyyy-MM-dd");
    const me = format(endOfMonth(d), "yyyy-MM-dd");
    const income = (financials ?? [])
      .filter((f) => f.type === "income" && f.date >= ms && f.date <= me)
      .reduce((s, f) => s + f.amount, 0);
    const expense = (financials ?? [])
      .filter((f) => f.type === "expense" && f.date >= ms && f.date <= me)
      .reduce((s, f) => s + f.amount, 0);
    return {
      month: format(d, "MMM", { locale: ptBR }),
      receita: income,
      despesa: expense,
    };
  });

  const kpis = [
    { title: "Faturamento Mensal", value: `R$ ${monthlyIncome.toFixed(2)}`, icon: DollarSign, color: "text-primary" },
    { title: "Lucro Mensal", value: `R$ ${monthlyProfit.toFixed(2)}`, icon: TrendingUp, color: monthlyProfit >= 0 ? "text-green-500" : "text-destructive" },
    { title: "Pedidos em Produção", value: ordersInProduction, icon: Package, color: "text-primary" },
    { title: "Orçamentos Pendentes", value: pendingQuotes, icon: FileText, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Faturamento vs Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="receita" fill="hsl(220, 70%, 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
