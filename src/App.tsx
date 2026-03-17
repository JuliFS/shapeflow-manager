import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { AppLayout } from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Quotes from "@/pages/Quotes";
import Orders from "@/pages/Orders";
import Financial from "@/pages/Financial";
import Stock from "@/pages/Stock";
import Settings from "@/pages/Settings";
import Parts from "@/pages/Parts";
import Reports from "@/pages/Reports";
import SuperAdmin from "@/pages/SuperAdmin";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Sonner />
        <AuthProvider>
          <CompanyProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
                <Route path="/quotes" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                <Route path="/financial" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
                <Route path="/stock" element={<ProtectedRoute><Stock /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/parts" element={<ProtectedRoute><Parts /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </CompanyProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
