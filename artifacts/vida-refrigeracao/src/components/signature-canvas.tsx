import React, { useRef, useEffect, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Button } from '@/components/ui/button';
import { PenLine, Eraser, Check } from 'lucide-react';

interface SignatureCanvasProps {
  onSave: (dataUrl: string | null) => void;
  initialValue?: string | null;
  label?: string;
  required?: boolean;
}

export function SignatureCanvas({ onSave, initialValue, label = "Assinatura", required = false }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isEditing, setIsEditing] = useState(!initialValue);

  useEffect(() => {
    if (isEditing && canvasRef.current) {
      const resizeCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d")?.scale(ratio, ratio);
        padRef.current?.clear();
      };
      
      padRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgba(255, 255, 255, 0)',
        penColor: 'rgb(0, 0, 0)'
      });
      
      padRef.current.addEventListener("beginStroke", () => setIsEmpty(false));
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      
      return () => {
        window.removeEventListener("resize", resizeCanvas);
        padRef.current?.off();
      };
    }
  }, [isEditing]);

  const handleClear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (padRef.current?.isEmpty()) {
      onSave(null);
    } else {
      const dataUrl = padRef.current?.toDataURL('image/png') || null;
      onSave(dataUrl);
      setIsEditing(false);
    }
  };

  const handleReSign = () => {
    setIsEditing(true);
    setIsEmpty(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
          <PenLine className="w-4 h-4" />
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
      </div>
      
      {!isEditing && initialValue ? (
        <div className="border border-border rounded-xl p-4 bg-muted/20 flex flex-col items-center gap-4">
          <img src={initialValue} alt="Assinatura salva" className="max-h-32 object-contain bg-white rounded-md border" />
          <Button variant="outline" size="sm" onClick={handleReSign} className="w-full sm:w-auto">
            <Eraser className="w-4 h-4 mr-2" />
            Reassinar
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`border-2 rounded-xl overflow-hidden bg-white touch-none ${isEmpty ? 'border-dashed border-muted-foreground/30' : 'border-solid border-primary/40 shadow-sm'}`}>
            <canvas 
              ref={canvasRef} 
              className="w-full h-40 cursor-crosshair"
              style={{ touchAction: "none" }}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={handleClear} className="flex-1" disabled={isEmpty}>
              <Eraser className="w-4 h-4 mr-2" />
              Limpar
            </Button>
            <Button type="button" onClick={handleSave} className="flex-1 font-semibold" disabled={isEmpty && required}>
              <Check className="w-4 h-4 mr-2" />
              Confirmar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
