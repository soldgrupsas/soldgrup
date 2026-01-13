import { useRef, useEffect, useCallback } from "react";
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

  // Función para limpiar y normalizar el HTML
  // Solo limpia tags problemáticos (font, atributos innecesarios), no toca el HTML normal
  const cleanHtml = useCallback((html: string): string => {
    if (!html) return "";
    
    // Si no hay tags problemáticos, devolver el HTML tal cual
    const hasProblematicTags = /<font[^>]*>|dir="auto"|vertical-align:\s*inherit/i.test(html);
    if (!hasProblematicTags) {
      return html;
    }
    
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
            const fragment = document.createDocumentFragment();
            const tempContent = document.createElement("div");
            tempContent.innerHTML = content;
            while (tempContent.firstChild) {
              fragment.appendChild(tempContent.firstChild);
            }
            parent.replaceChild(fragment, font);
            return; // Ya reemplazamos, continuar con el siguiente
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
  }, []);

  // Inicializar y actualizar el contenido
  useEffect(() => {
    if (!editorRef.current || isUpdatingRef.current) return;
    
    const normalizedValue = value || "";
    
    // Solo limpiar si hay tags problemáticos (font, atributos innecesarios)
    // NO limpiar divs normales
    const hasProblematicTags = normalizedValue ? /<font[^>]*>|dir="auto"|vertical-align:\s*inherit/i.test(normalizedValue) : false;
    const cleanedValue = (normalizedValue && hasProblematicTags) ? cleanHtml(normalizedValue) : normalizedValue;
    
    // Comparar el contenido actual con el valor
    const currentContent = editorRef.current.innerHTML.trim();
    const targetValue = cleanedValue.trim();
    
    // Solo actualizar si el contenido es diferente
    if (currentContent !== targetValue && lastValueRef.current !== cleanedValue) {
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
      
      // Limpiar el contenido primero
      editorRef.current.textContent = "";
      
      // Establecer el HTML limpio usando insertAdjacentHTML para asegurar renderizado correcto
      if (cleanedValue) {
        // Crear un elemento temporal para parsear el HTML
        const tempContainer = document.createElement("div");
        tempContainer.innerHTML = cleanedValue;
        
        // Mover todos los nodos al editor
        while (tempContainer.firstChild) {
          editorRef.current.appendChild(tempContainer.firstChild);
        }
      }
      
      lastValueRef.current = cleanedValue;
      
      // Si el valor se limpió y hay tags problemáticos, actualizar el estado padre
      // Esto asegura que el HTML limpio se guarde en la base de datos
      // Pero solo hacerlo una vez, no en cada render
      if (hasProblematicTags && cleanedValue !== normalizedValue && cleanedValue) {
        // Usar setTimeout para evitar actualizaciones síncronas que causen loops
        const timeoutId = setTimeout(() => {
          if (!isUpdatingRef.current && cleanedValue !== value) {
            onChange(cleanedValue);
          }
        }, 100);
        return () => clearTimeout(timeoutId);
      }
      
      // Restaurar el cursor si estaba dentro del editor
      if (savedRange) {
        try {
          requestAnimationFrame(() => {
            const newRange = document.createRange();
            newRange.setStart(savedRange.startContainer, savedRange.startOffset);
            newRange.setEnd(savedRange.endContainer, savedRange.endOffset);
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          });
        } catch (e) {
          // Si falla restaurar el cursor, simplemente continuar
        }
      }
      
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  }, [value, cleanHtml, onChange]);

  const handleInput = () => {
    if (editorRef.current && !isUpdatingRef.current) {
      const rawHtml = editorRef.current.innerHTML;
      
      // Solo limpiar si hay tags problemáticos (font tags, atributos innecesarios)
      // NO limpiar divs normales que contentEditable crea al presionar Enter
      const hasProblematicTags = /<font[^>]*>|dir="auto"|vertical-align:\s*inherit/i.test(rawHtml);
      
      if (hasProblematicTags) {
        isUpdatingRef.current = true;
        const cleanedHtml = cleanHtml(rawHtml);
        lastValueRef.current = cleanedHtml;
        
        // Solo actualizar si realmente cambió
        if (editorRef.current.innerHTML.trim() !== cleanedHtml.trim()) {
          const selection = window.getSelection();
          const range = selection?.rangeCount > 0 ? selection.getRangeAt(0) : null;
          const savedRange = range && editorRef.current.contains(range.startContainer) ? {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset,
          } : null;
          
          editorRef.current.innerHTML = cleanedHtml;
          
          // Restaurar el cursor
          if (savedRange) {
            try {
              requestAnimationFrame(() => {
                const newRange = document.createRange();
                newRange.setStart(savedRange.startContainer, savedRange.startOffset);
                newRange.setEnd(savedRange.endContainer, savedRange.endOffset);
                selection?.removeAllRanges();
                selection?.addRange(newRange);
              });
            } catch (e) {
              // Ignorar errores al restaurar cursor
            }
          }
        }
        
        onChange(cleanedHtml);
        
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 0);
      } else {
        // HTML normal, solo actualizar el estado
        lastValueRef.current = rawHtml;
        onChange(rawHtml);
      }
    }
  };

  const insertFormat = (format: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

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
        suppressContentEditableWarning={true}
      />
      <div className="text-xs text-muted-foreground">
        Selecciona texto y usa los botones para aplicar formato
      </div>
    </div>
  );
};
