import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

const statusLabels: Record<OrderStatus, string> = {
  queue: "Fila",
  printing: "Imprimindo",
  post_processing: "Pós-processamento",
  finished: "Finalizado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const statusColors: Record<OrderStatus, string> = {
  queue: "bg-muted text-muted-foreground",
  printing: "bg-primary/10 text-primary",
  post_processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  finished: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  delivered: "bg-green-200 text-green-800 dark:bg-green-800/40 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const statusOrder: OrderStatus[] = ["queue", "printing", "post_processing", "finished", "delivered", "cancelled"];

export default function Orders() {
  const { user } = useAuth();
  const { currentCompanyId } = useCompany();
  const qc = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").eq("company_id", currentCompanyId!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!currentCompanyId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;

      if (status === "delivered") {
        const order = orders.find((o) => o.id === id);
        if (order && order.final_price) {
          await supabase.from("financial_records").insert({
            user_id: user!.id,
            company_id: currentCompanyId!,
            type: "income",
            amount: order.final_price,
            category: "Pedido entregue",
            description: `Pedido ${order.quote_number} - ${order.piece_name}`,
            order_id: id,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["financials"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido apagado!");
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Orçamento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Peça</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-48">Alterar Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum pedido</TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.quote_number}</TableCell>
                    <TableCell>{o.client_name}</TableCell>
                    <TableCell>{o.piece_name}</TableCell>
                    <TableCell className="font-semibold">R$ {(o.final_price ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[o.status]}>{statusLabels[o.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={o.status} onValueChange={(v) => updateStatus.mutate({ id: o.id, status: v as OrderStatus })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOrder.map((s) => (
                            <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apagar pedido?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Essa ação não pode ser desfeita. O pedido "{o.piece_name}" será removido permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteOrder.mutate(o.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Apagar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
