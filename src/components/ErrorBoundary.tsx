import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // No capturar errores de DOM como removeChild
    if (error.message?.includes("removeChild") || error.message?.includes("NotFoundError")) {
      console.warn("Ignorando error de DOM:", error.message);
      // No establecer hasError para errores de DOM
      return {
        hasError: false,
        error: null,
        errorInfo: null,
      };
    }

    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // No capturar errores de DOM
    if (error.message?.includes("removeChild") || error.message?.includes("NotFoundError")) {
      console.warn("Ignorando error de DOM en ErrorBoundary:", error.message);
      return;
    }

    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Si es un error de autenticación, redirigir al login después de un momento
    if (
      error.message?.includes("Refresh Token") ||
      error.message?.includes("JWT") ||
      error.message?.includes("session") ||
      error.name === "AuthApiError"
    ) {
      setTimeout(() => {
        window.location.href = "/auth";
      }, 2000);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isAuthError =
        this.state.error?.message?.includes("Refresh Token") ||
        this.state.error?.message?.includes("JWT") ||
        this.state.error?.message?.includes("session") ||
        this.state.error?.name === "AuthApiError";

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-industrial p-4">
          <Card className="max-w-2xl w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <h1 className="text-2xl font-bold">
                {isAuthError ? "Sesión expirada" : "Ocurrió un error"}
              </h1>
            </div>
            <p className="text-muted-foreground mb-4">
              {isAuthError
                ? "Tu sesión ha expirado. Serás redirigido al login en unos momentos..."
                : "Lo sentimos, ocurrió un error inesperado. Por favor, intenta recargar la página."}
            </p>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-4 p-4 bg-muted rounded-md">
                <summary className="cursor-pointer font-semibold mb-2">
                  Detalles del error (solo en desarrollo)
                </summary>
                <pre className="text-xs overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div className="flex gap-2 mt-6">
              <Button onClick={() => window.location.href = "/auth"}>
                Ir al Login
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Recargar Página
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper para usar hooks en el componente
export const ErrorBoundary: React.FC<Props> = (props) => {
  return <ErrorBoundaryClass {...props} />;
};

