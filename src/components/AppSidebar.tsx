import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  DollarSign,
  Boxes,
  Settings,
  Printer,
  Puzzle,
  BarChart3,
  Shield,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clients", icon: Users },
  { title: "Orçamentos", url: "/quotes", icon: FileText },
  { title: "Pedidos", url: "/orders", icon: Package },
  { title: "Peças", url: "/parts", icon: Puzzle },
  { title: "Financeiro", url: "/financial", icon: DollarSign },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
  { title: "Estoque", url: "/stock", icon: Boxes },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useAuth();

  const { data: isSuperAdmin } = useQuery({
    queryKey: ["is_super_admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("super_admins").select("id").eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const allItems = [
    ...items,
    ...(isSuperAdmin ? [{ title: "Super Admin", url: "/admin", icon: Shield }] : []),
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
        <Printer className="h-6 w-6 text-primary shrink-0" />
        {!collapsed && (
          <span className="ml-2.5 text-base font-bold tracking-tight text-foreground">
            3D Manager
          </span>
        )}
      </div>
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {allItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-primary/10 text-primary font-semibold"
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
