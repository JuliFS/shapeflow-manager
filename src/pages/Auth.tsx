import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer } from "lucide-react";
import { toast } from "sonner";

type Mode = "login" | "register" | "forgot";

export default function Auth() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        toast.success("Login realizado com sucesso!");
      } else if (mode === "register") {
        await signUp(email, password, fullName);
        toast.success("Conta criada! Verifique seu email.");
      } else {
        await resetPassword(email);
        toast.success("Email de recuperação enviado!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar solicitação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex items-center gap-2">
              <Printer className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold tracking-tight">3D Manager</span>
            </div>
          </div>
          <CardTitle className="text-xl">
            {mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Recuperar senha"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Entre com suas credenciais"
              : mode === "register"
              ? "Preencha seus dados para criar uma conta"
              : "Informe seu email para recuperar a senha"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Processando..." : mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Enviar email"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm space-y-1">
            {mode === "login" && (
              <>
                <button onClick={() => setMode("forgot")} className="text-primary hover:underline block w-full">
                  Esqueci minha senha
                </button>
                <button onClick={() => setMode("register")} className="text-muted-foreground hover:text-foreground block w-full">
                  Não tem conta? <span className="text-primary">Criar conta</span>
                </button>
              </>
            )}
            {mode !== "login" && (
              <button onClick={() => setMode("login")} className="text-primary hover:underline">
                Voltar para login
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
