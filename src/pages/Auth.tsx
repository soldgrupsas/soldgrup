import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import soldgrupLogo from "@/assets/soldgrup-logo.webp";

// Componente para copos de nieve
const Snowflake = ({ delay, duration, left }: { delay: number; duration: number; left: string }) => (
  <div
    className="absolute text-white text-xl opacity-75 pointer-events-none"
    style={{
      left: `${left}%`,
      animation: `fall ${duration}s linear ${delay}s infinite`,
      top: '-10px',
    }}
  >
    ❄
  </div>
);

// Componente para estrellas navideñas
const Star = ({ delay, left, top }: { delay: number; left: string; top: string }) => (
  <div
    className="absolute text-yellow-300 text-2xl opacity-80 pointer-events-none"
    style={{
      left: `${left}%`,
      top: `${top}%`,
      animation: `twinkle ${2 + delay}s ease-in-out ${delay}s infinite`,
    }}
  >
    ⭐
  </div>
);

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
        navigate("/home");
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

  // Generar copos de nieve
  const snowflakes = Array.from({ length: 30 }, (_, i) => (
    <Snowflake
      key={`snow-${i}`}
      delay={Math.random() * 5}
      duration={5 + Math.random() * 10}
      left={`${Math.random() * 100}`}
    />
  ));

  // Generar estrellas
  const stars = Array.from({ length: 25 }, (_, i) => (
    <Star
      key={`star-${i}`}
      delay={Math.random() * 2}
      left={`${5 + Math.random() * 90}`}
      top={`${5 + Math.random() * 85}`}
    />
  ));

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #16213e 75%, #1a1a2e 100%)',
      }}
    >
      {/* Copos de nieve */}
      {snowflakes}
      
      {/* Estrellas decorativas */}
      {stars}

      {/* Decoración navideña superior */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-green-500 to-red-500"></div>
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-green-500 via-red-500 to-green-500"></div>

      <Card className="w-full max-w-md p-8 space-y-6 relative z-10 border-2 border-red-500/30 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 250, 250, 0.98) 100%)',
          boxShadow: '0 20px 60px rgba(220, 38, 38, 0.3), 0 0 40px rgba(34, 197, 94, 0.2)',
        }}
      >
        {/* Decoración navideña en el card */}
        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-4xl">🎄</div>
        
        <div className="flex justify-center items-center gap-2 mb-2">
          <span className="text-2xl">🎅</span>
        <img
          src={soldgrupLogo}
          alt="Soldgrup - La fuerza de su industria"
            className="h-20 w-auto"
        />
          <span className="text-2xl">🎄</span>
        </div>
        
        <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-red-600 to-green-600 bg-clip-text text-transparent">
          Iniciar sesión
        </h1>
        
        <p className="text-center text-sm text-red-600 font-semibold">
          ¡Feliz Navidad! 🎉
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email" className="text-gray-700 font-medium">Email</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-2 border-green-300 focus:border-red-400 focus:ring-red-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password" className="text-gray-700 font-medium">Contraseña</Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-2 border-green-300 focus:border-red-400 focus:ring-red-300"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-red-600 to-green-600 hover:from-red-700 hover:to-green-700 text-white font-bold text-lg py-6 shadow-lg transform transition-all duration-300 hover:scale-105" 
            disabled={loading}
          >
            {loading ? "Iniciando sesión..." : "🎁 Iniciar Sesión"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            La creación de nuevos usuarios y cambio de contraseña solo lo puede hacer un usuario Administrador.
          </p>
        </form>
      </Card>

      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes twinkle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
};

export default Auth;
