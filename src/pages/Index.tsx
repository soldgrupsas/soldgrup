import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-industrial">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-5xl font-bold text-foreground mb-4">
          Sistema de Propuestas Comerciales
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Crea, gestiona y comparte propuestas profesionales para proyectos de electrificación industrial
        </p>
        <Button onClick={() => navigate("/dashboard")} size="lg" className="mt-6">
          Ir al Dashboard
        </Button>
      </div>
    </div>
  );
};

export default Index;
