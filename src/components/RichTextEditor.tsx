import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEditor = ({ value, onChange, placeholder }: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);
  const lastValueRef = useRef<string>("");

  // Inicializar el contenido cuando el componente se monta
  useEffect(() => {
    if (editorRef.current && value) {
      const cleanedValue = cleanHtml(value);
      if (cleanedValue !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = cleanedValue;
        lastValueRef.current = cleanedValue;
        // Si se limpió, actualizar el estado padre
        if (cleanedValue !== value) {
          onChange(cleanedValue);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!editorRef.current || isUpdatingRef.current) return;
    
    const currentContent = editorRef.current.innerHTML;
    const normalizedValue = value || "";
    
    // Limpiar el valor cargado si contiene HTML antiguo
    const cleanedValue = normalizedValue ? cleanHtml(normalizedValue) : "";
    
    // Solo actualizar si el contenido es diferente y no es una actualización interna
    if (currentContent !== cleanedValue && lastValueRef.current !== cleanedValue) {
      // Preservar el cursor si es posible
      const selection = window.getSelection();
      const range = selection?.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const savedRange = range && editorRef.current.contains(range.startContainer) ? {
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
      } : null;
      
      isUpdatingRef.current = true;
      editorRef.current.innerHTML = cleanedValue;
      lastValueRef.current = cleanedValue;
      
      // Si el valor se limpió, actualizar el estado padre
      if (cleanedValue !== normalizedValue && cleanedValue) {
        onChange(cleanedValue);
      }
      
      // Restaurar el cursor si estaba dentro del editor
      if (savedRange) {
        try {
          const newRange = document.createRange();
          newRange.setStart(savedRange.startContainer, savedRange.startOffset);
          newRange.setEnd(savedRange.endContainer, savedRange.endOffset);
          selection?.removeAllRanges();
          selection?.addRange(newRange);
        } catch (e) {
          // Si falla restaurar el cursor, simplemente continuar
        }
      }
      
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  }, [value]);

  // Función para limpiar y normalizar el HTML
  const cleanHtml = (html: string): string => {
    if (!html) return "";
    
    // Crear un elemento temporal para procesar el HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    
    // Función recursiva para reemplazar tags <font> anidados
    const replaceFontTags = (element: Element | DocumentFragment) => {
      // Buscar todos los tags font, incluso los anidados
      const fontTags = Array.from(element.querySelectorAll("font"));
      
      // Procesar de adentro hacia afuera (más anidados primero)
      fontTags.sort((a, b) => {
        let depthA = 0;
        let depthB = 0;
        let currentA: Node | null = a;
        let currentB: Node | null = b;
        while (currentA?.parentNode) {
          depthA++;
          currentA = currentA.parentNode;
        }
        while (currentB?.parentNode) {
          depthB++;
          currentB = currentB.parentNode;
        }
        return depthB - depthA; // Más profundo primero
      });
      
      fontTags.forEach((font) => {
        const parent = font.parentNode;
        if (parent && parent !== tempDiv) {
          // Extraer el contenido (ya procesado si tenía tags font anidados)
          const content = font.innerHTML;
          const style = font.getAttribute("style") || "";
          const isBold = style.includes("font-weight: 700") || 
                        style.includes("font-weight:bold") || 
                        style.includes("font-weight: 600") ||
                        font.getAttribute("face")?.toLowerCase().includes("bold");
          const isItalic = style.includes("font-style: italic") || 
                          style.includes("font-style:italic");
          
          // Crear elemento apropiado
          let replacement: HTMLElement;
          if (isBold && isItalic) {
            replacement = document.createElement("strong");
            const em = document.createElement("em");
            em.innerHTML = content;
            replacement.appendChild(em);
          } else if (isBold) {
            replacement = document.createElement("strong");
            replacement.innerHTML = content;
          } else if (isItalic) {
            replacement = document.createElement("em");
            replacement.innerHTML = content;
          } else {
            // Si no tiene formato especial, solo extraer el contenido sin el tag
            replacement = document.createElement("span");
            replacement.innerHTML = content;
          }
          
          parent.replaceChild(replacement, font);
        }
      });
    };
    
    // Reemplazar todos los tags font
    replaceFontTags(tempDiv);
    
    // Limpiar atributos innecesarios de todos los elementos
    const allElements = tempDiv.querySelectorAll("*");
    allElements.forEach((el) => {
      // Remover atributos dir="auto" innecesarios
      if (el.getAttribute("dir") === "auto") {
        el.removeAttribute("dir");
      }
      
      // Limpiar estilos innecesarios
      const style = el.getAttribute("style");
      if (style) {
        // Remover vertical-align: inherit
        let cleanedStyle = style.replace(/vertical-align:\s*inherit;?/gi, "").trim();
        // Remover estilos vacíos o solo con punto y coma
        cleanedStyle = cleanedStyle.replace(/^;+\s*|;+\s*$/g, "").trim();
        
        if (cleanedStyle) {
          el.setAttribute("style", cleanedStyle);
        } else {
          el.removeAttribute("style");
        }
      }
      
      // Remover spans vacíos o sin atributos importantes
      if (el.tagName.toLowerCase() === "span" && 
          !el.getAttribute("style") && 
          !el.getAttribute("class") &&
          !el.getAttribute("id")) {
        const parent = el.parentNode;
        if (parent && parent !== tempDiv) {
          const fragment = document.createDocumentFragment();
          while (el.firstChild) {
            fragment.appendChild(el.firstChild);
          }
          parent.replaceChild(fragment, el);
        }
      }
    });
    
    return tempDiv.innerHTML;
  };

  const handleInput = () => {
    if (editorRef.current && !isUpdatingRef.current) {
      isUpdatingRef.current = true;
      const rawHtml = editorRef.current.innerHTML;
      // Limpiar el HTML antes de guardarlo
      const cleanedHtml = cleanHtml(rawHtml);
      onChange(cleanedHtml);
      // Actualizar el contenido del editor con el HTML limpio
      if (editorRef.current.innerHTML !== cleanedHtml) {
        editorRef.current.innerHTML = cleanedHtml;
      }
      // Reset flag after a short delay to allow the onChange to propagate
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  };

  const insertFormat = (format: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;

    switch (format) {
      case "bold":
        document.execCommand("bold", false);
        break;
      case "italic":
        document.execCommand("italic", false);
        break;
      case "bullet":
        document.execCommand("insertUnorderedList", false);
        break;
      default:
        return;
    }

    handleInput();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 border border-border rounded-t-md p-1 bg-muted/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertFormat("bold")}
          className="h-8 px-2"
          title="Negrita"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertFormat("italic")}
          className="h-8 px-2"
          title="Cursiva"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertFormat("bullet")}
          className="h-8 px-2"
          title="Viñeta"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="min-h-[100px] w-full rounded-b-md border border-t-0 border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-placeholder={placeholder}
        style={{
          whiteSpace: "pre-wrap",
        }}
      />
      <div className="text-xs text-muted-foreground">
        Selecciona texto y usa los botones para aplicar formato
      </div>
    </div>
  );
};
