import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import soldgrupLogo from "@/assets/soldgrup-logo.webp";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Listen for auth changes - only redirect when user explicitly signs in
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Solo redirigir cuando el usuario inicia sesión explícitamente, no si ya hay una sesión
      if (session && event === "SIGNED_IN") {
        // Si es el usuario de asistencia, redirigir directamente al control de horas
        if (session.user.email === "asistencia@soldgrup.com") {
          navigate("/time-control");
        } else {
          navigate("/home");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error al iniciar sesión",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-industrial">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex justify-center items-center mb-2">
        <img
          src={soldgrupLogo}
          alt="Soldgrup - La fuerza de su industria"
            className="h-20 w-auto"
        />
        </div>
        
        <h1 className="text-3xl font-bold text-center">
          Iniciar sesión
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password">Contraseña</Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            La creación de nuevos usuarios y cambio de contraseña solo lo puede hacer un usuario Administrador.
          </p>
        </form>
      </Card>
    </div>
  );
};

export default Auth;
