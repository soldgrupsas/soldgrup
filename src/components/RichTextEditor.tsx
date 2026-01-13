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
  const cleanHtml = useCallback((html: string): string => {
    if (!html) return "";
    
    // Primero, decodificar cualquier HTML escapado (si el HTML viene como texto plano)
    // Esto maneja casos donde el HTML está escapado como &lt;font&gt; en lugar de <font>
    let decodedHtml = html;
    try {
      // Crear un elemento temporal para decodificar
      const decodeDiv = document.createElement("div");
      decodeDiv.textContent = html;
      decodedHtml = decodeDiv.innerHTML;
      // Si no cambió, significa que no estaba escapado, usar el original
      if (decodedHtml === html) {
        decodedHtml = html;
      }
    } catch (e) {
      // Si falla, usar el HTML original
      decodedHtml = html;
    }
    
    // Crear un elemento temporal para procesar el HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = decodedHtml;
    
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
    
    // Convertir <div> a <br> para mantener saltos de línea
    // Procesar todos los divs de adentro hacia afuera
    const processDivs = () => {
      const divs = Array.from(tempDiv.querySelectorAll("div"));
      if (divs.length === 0) return;
      
      // Ordenar por profundidad (más profundo primero)
      divs.sort((a, b) => {
        let depthA = 0;
        let depthB = 0;
        let currentA: Node | null = a;
        let currentB: Node | null = b;
        while (currentA?.parentNode && currentA.parentNode !== tempDiv) {
          depthA++;
          currentA = currentA.parentNode;
        }
        while (currentB?.parentNode && currentB.parentNode !== tempDiv) {
          depthB++;
          currentB = currentB.parentNode;
        }
        return depthB - depthA; // Más profundo primero
      });
      
      divs.forEach((div) => {
        // Si el div es el contenedor principal (tempDiv), no hacer nada
        if (div === tempDiv) return;
        
        const parent = div.parentNode;
        if (parent) {
          // Crear un fragmento para el contenido
          const fragment = document.createDocumentFragment();
          
          // Si el div tiene contenido, agregar un <br> antes del contenido
          // (excepto si es el primer hijo y no hay contenido antes)
          const hasPreviousSibling = div.previousSibling !== null;
          const hasContent = div.textContent?.trim() || div.children.length > 0;
          
          // Verificar si hay un elemento hermano anterior que sea texto o elemento
          const prevSibling = div.previousSibling;
          const shouldAddBr = hasContent && (
            hasPreviousSibling || 
            (prevSibling && prevSibling.nodeType === Node.TEXT_NODE && prevSibling.textContent?.trim())
          );
          
          if (shouldAddBr) {
            const br = document.createElement("br");
            fragment.appendChild(br);
          }
          
          // Mover todo el contenido del div al fragmento
          while (div.firstChild) {
            fragment.appendChild(div.firstChild);
          }
          
          // Reemplazar el div con el fragmento
          if (parent !== tempDiv) {
            parent.replaceChild(fragment, div);
          }
        }
      });
      
      // Si aún hay divs, procesar de nuevo (puede haber divs anidados que quedaron)
      const remainingDivs = tempDiv.querySelectorAll("div");
      if (remainingDivs.length > 0) {
        // Limitar recursión para evitar loops infinitos
        const maxIterations = 10;
        let iterations = 0;
        const processAgain = () => {
          iterations++;
          if (iterations < maxIterations) {
            processDivs();
          }
        };
        processAgain();
      }
    };
    
    processDivs();
    
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
    // Siempre limpiar el HTML, incluso si parece estar bien
    const cleanedValue = normalizedValue ? cleanHtml(normalizedValue) : "";
    
    // Comparar el contenido actual con el valor limpio
    const currentContent = editorRef.current.innerHTML.trim();
    const cleanedValueTrimmed = cleanedValue.trim();
    
    // Solo actualizar si el contenido es diferente
    if (currentContent !== cleanedValueTrimmed && lastValueRef.current !== cleanedValue) {
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
      
      // Si el valor se limpió, actualizar el estado padre (pero evitar loop infinito)
      // Esto asegura que el HTML limpio se guarde en la base de datos
      if (cleanedValue !== normalizedValue && cleanedValue) {
        // Usar setTimeout para evitar actualizaciones síncronas que causen loops
        setTimeout(() => {
          if (!isUpdatingRef.current && cleanedValue !== value) {
            onChange(cleanedValue);
          }
        }, 100);
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
      isUpdatingRef.current = true;
      const rawHtml = editorRef.current.innerHTML;
      // Limpiar el HTML antes de guardarlo
      const cleanedHtml = cleanHtml(rawHtml);
      lastValueRef.current = cleanedHtml;
      
      // Actualizar el contenido del editor con el HTML limpio si es diferente
      // Esto asegura que el editor siempre muestre HTML limpio
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
        
        // Restaurar el cursor si es posible
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
            // Si falla, simplemente continuar
          }
        }
      }
      
      onChange(cleanedHtml);
      
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
