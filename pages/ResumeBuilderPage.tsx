import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Printer, Settings, Check, Layout, Palette, Camera, MapPin } from "lucide-react";
import { ClassicTemplate } from "../components/resume-templates/ClassicTemplate";
import { ModernTemplate } from "../components/resume-templates/ModernTemplate";
import { MinimalistTemplate } from "../components/resume-templates/MinimalistTemplate";
import { CreativeTemplate } from "../components/resume-templates/CreativeTemplate";

const TEMPLATES = [
  { id: "modern", name: "Moderno" },
  { id: "creative", name: "Criativo" },
  { id: "classic", name: "Clássico" },
  { id: "minimalist", name: "Minimalista" },
] as const;

const ACCENT_COLORS = [
  { hex: "#0284c7", name: "Azul" },
  { hex: "#f97316", name: "Laranja" },
  { hex: "#16a34a", name: "Verde" },
  { hex: "#dc2626", name: "Vermelho" },
  { hex: "#7c3aed", name: "Roxo" },
  { hex: "#292524", name: "Escuro" },
  { hex: "#1c1917", name: "Preto" },
];

type TemplateId = (typeof TEMPLATES)[number]["id"];

export function ResumeBuilderPage() {
  const { profile, loading } = useAuth();
  const [template, setTemplate] = useState<TemplateId>("modern");
  const [color, setColor] = useState("#0284c7");
  const [showPhoto, setShowPhoto] = useState(true);
  const [address, setAddress] = useState("");
  const [scale, setScale] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);

  // Calculate scale to fit A4 (794px) into available width
  const recalcScale = useCallback(() => {
    if (!previewRef.current) return;
    const available = previewRef.current.clientWidth - 16; // 8px padding each side
    setScale(available < 794 ? available / 794 : 1);
  }, []);

  useEffect(() => {
    recalcScale();
    window.addEventListener("resize", recalcScale);
    return () => window.removeEventListener("resize", recalcScale);
  }, [recalcScale]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">
        Carregando gerador...
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  const handlePrint = () => window.print();

  const templateProps = { profile, color, showPhoto, address };

  const renderTemplate = () => {
    switch (template) {
      case "classic":     return <ClassicTemplate {...templateProps} />;
      case "minimalist":  return <MinimalistTemplate {...templateProps} />;
      case "creative":    return <CreativeTemplate {...templateProps} />;
      case "modern":
      default:            return <ModernTemplate {...templateProps} />;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-stone-100 flex flex-col md:flex-row" id="resume-builder-root">

        {/* ─── Sidebar Controls (hidden when printing) ─── */}
        <aside
          id="resume-builder-sidebar"
          className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-stone-200 flex flex-col md:h-screen md:sticky md:top-0 z-10 shrink-0"
        >
          {/* Top bar */}
          <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-3">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 text-stone-600 hover:text-terracotta-600 font-medium text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Link>
            <button
              onClick={handlePrint}
              className="bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" /> Exportar PDF
            </button>
          </div>

          {/* Controls */}
          <div className="p-5 md:p-6 flex-1 overflow-y-auto space-y-7">

            {/* Template picker */}
            <section>
              <h2 className="text-xs font-bold text-stone-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Layout className="w-4 h-4 text-stone-400" /> Modelos
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setTemplate(tpl.id)}
                    className={`py-2.5 px-2 border-2 rounded-xl text-sm font-bold transition-all ${
                      template === tpl.id
                        ? "border-terracotta-600 text-terracotta-700 bg-terracotta-50"
                        : "border-stone-200 text-stone-600 hover:border-stone-300 bg-white"
                    }`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </section>

            {/* Color picker */}
            <section>
              <h2 className="text-xs font-bold text-stone-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4 text-stone-400" /> Cor de Destaque
              </h2>
              <div className="flex flex-wrap gap-2.5">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => setColor(c.hex)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-sm"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                    aria-label={`Selecionar cor ${c.name}`}
                  >
                    {color === c.hex && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </section>

            {/* Options */}
            <section>
              <h2 className="text-xs font-bold text-stone-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4 text-stone-400" /> Opções
              </h2>

              <div className="space-y-4">
                {/* Photo toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    className={`w-10 h-6 rounded-full transition-colors flex items-center p-1 ${
                      showPhoto ? "bg-terracotta-500" : "bg-stone-300"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                        showPhoto ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </div>
                  <span className="text-sm font-medium text-stone-700 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-stone-400" /> Mostrar foto
                  </span>
                  <input
                    type="checkbox"
                    checked={showPhoto}
                    onChange={(e) => setShowPhoto(e.target.checked)}
                    className="hidden"
                  />
                </label>

                {/* Address input */}
                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-stone-400" /> Endereço
                    <span className="text-stone-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ex: Pirassununga, SP"
                    className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                  />
                </div>
              </div>
            </section>
          </div>
        </aside>

        {/* ─── Preview Area ─── */}
        <main
          ref={previewRef}
          id="resume-preview-area"
          className="flex-1 overflow-x-hidden overflow-y-auto bg-stone-100 p-4 md:p-8 flex justify-center items-start"
        >
          <div
            className="origin-top transition-transform duration-150"
            style={{
              transform: `scale(${scale})`,
              width: "210mm",
              transformOrigin: "top center",
            }}
          >
            {renderTemplate()}
          </div>
        </main>
      </div>

      {/* ─── Print-only Styles ─── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }
  html, body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  #resume-builder-sidebar {
    display: none !important;
  }
  #resume-builder-root {
    display: block !important;
    background: white !important;
  }
  #resume-preview-area {
    padding: 0 !important;
    background: white !important;
    overflow: visible !important;
  }
  #resume-preview-area > div {
    transform: none !important;
    width: 100% !important;
  }
}
`,
        }}
      />
    </>
  );
}
