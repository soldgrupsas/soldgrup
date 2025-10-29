import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import soldgrupLogo from "@/assets/soldgrup-logo.webp";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-industrial">
      <div className="text-center space-y-6 p-8">
        <img 
          src={soldgrupLogo} 
          alt="Soldgrup - La fuerza de su industria" 
          className="mx-auto mb-8 h-24 w-auto"
        />
        <h1 className="text-5xl font-bold text-foreground mb-4">
          Smart Workspace
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Hub de mejoramiento corporativo
        </p>
        <Button onClick={() => navigate("/auth")} size="lg" className="mt-6">
          Iniciar Sesión
        </Button>
      </div>
    </div>
  );
};

export default Index;
