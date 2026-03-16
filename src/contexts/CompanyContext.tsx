import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Company {
  id: string;
  name: string;
  plan: string;
  created_at: string;
  role: string;
}

interface CompanyContextType {
  companies: Company[];
  currentCompanyId: string | null;
  currentCompany: Company | null;
  setCurrentCompanyId: (id: string) => void;
  loading: boolean;
  refetch: () => void;
}

const CompanyContext = createContext<CompanyContextType>({} as CompanyContextType);

export const useCompany = () => useContext(CompanyContext);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompanyId, setCurrentCompanyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = async () => {
    if (!user) {
      setCompanies([]);
      setCurrentCompanyIdState(null);
      setLoading(false);
      return;
    }

    const { data: memberships } = await supabase
      .from("user_companies")
      .select("company_id, role")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      setCompanies([]);
      setLoading(false);
      return;
    }

    const companyIds = memberships.map((m: any) => m.company_id);
    const { data: companyData } = await supabase
      .from("companies")
      .select("*")
      .in("id", companyIds);

    const merged = (companyData ?? []).map((c: any) => ({
      ...c,
      role: memberships.find((m: any) => m.company_id === c.id)?.role ?? "member",
    }));

    setCompanies(merged);

    const stored = localStorage.getItem(`company_${user.id}`);
    if (stored && merged.some((c: any) => c.id === stored)) {
      setCurrentCompanyIdState(stored);
    } else if (merged.length > 0) {
      setCurrentCompanyIdState(merged[0].id);
      localStorage.setItem(`company_${user.id}`, merged[0].id);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchCompanies();
  }, [user]);

  const setCurrentCompanyId = (id: string) => {
    setCurrentCompanyIdState(id);
    if (user) localStorage.setItem(`company_${user.id}`, id);
  };

  const currentCompany = companies.find((c) => c.id === currentCompanyId) ?? null;

  return (
    <CompanyContext.Provider value={{ companies, currentCompanyId, currentCompany, setCurrentCompanyId, loading, refetch: fetchCompanies }}>
      {children}
    </CompanyContext.Provider>
  );
}
