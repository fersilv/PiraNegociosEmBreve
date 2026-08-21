import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, WandSparkles } from "lucide-react";
import { ResumeBuilderPage } from "./ResumeBuilderPage";

export function ResumeBuilderStudio() {
  return (
    <div className="resume-studio">
      <ResumeStudioTheme />

      <header className="resume-studio-header">
        <div className="resume-studio-header__inner">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/user" className="resume-studio-back" aria-label="Voltar ao meu espaço">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="resume-studio-kicker">PiraNegócios Career</span>
                <span className="resume-studio-dot" />
                <span className="resume-studio-kicker resume-studio-kicker--muted">Currículo</span>
              </div>
              <h1 className="truncate font-serif text-xl font-bold text-[#241914] sm:text-2xl">
                Seu currículo profissional
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="resume-studio-trust">
              <ShieldCheck className="h-3.5 w-3.5" /> Integrado ao seu perfil
            </span>
            <span className="resume-studio-trust">
              <WandSparkles className="h-3.5 w-3.5" /> Editor inteligente
            </span>
          </div>
        </div>
      </header>

      <main className="resume-studio-body">
        <ResumeBuilderPage />
      </main>
    </div>
  );
}

function ResumeStudioTheme() {
  return (
    <style>{`
      .resume-studio {
        --rs-ink: #241914;
        --rs-line: rgba(75, 51, 38, .12);
        min-height: 100vh;
        color: var(--rs-ink);
        background: linear-gradient(180deg, #f8f3ed 0%, #f2ebe3 100%);
      }

      .resume-studio-header {
        position: sticky;
        top: 0;
        z-index: 40;
        border-bottom: 1px solid var(--rs-line);
        background: rgba(249, 244, 238, .96);
        backdrop-filter: blur(18px);
      }

      .resume-studio-header__inner {
        display: flex;
        min-height: 76px;
        max-width: 1600px;
        margin: 0 auto;
        padding: 12px 24px;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }

      .resume-studio-back {
        display: inline-flex;
        width: 42px;
        height: 42px;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--rs-line);
        border-radius: 14px;
        background: #fffdfa;
        color: #5e5048;
        box-shadow: 0 6px 20px rgba(65,43,29,.05);
      }

      .resume-studio-kicker {
        font-size: 9px;
        font-weight: 800;
        letter-spacing: .18em;
        text-transform: uppercase;
        color: #b55236;
      }

      .resume-studio-kicker--muted { color: #9b8b81; }
      .resume-studio-dot { width: 3px; height: 3px; border-radius: 999px; background: #cabbb0; }

      .resume-studio-trust {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 8px 11px;
        border: 1px solid var(--rs-line);
        border-radius: 999px;
        background: #fffdfa;
        color: #78695f;
        font-size: 10px;
        font-weight: 700;
      }

      /* Remove apenas o header legado do builder. */
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > header {
        display: none !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col,
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center,
      .resume-studio-body #resume-builder-root {
        min-height: auto !important;
        background: transparent !important;
      }

      /* Etapas: sticky, mas a rolagem continua sendo a da página. */
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > div.bg-white.border-b {
        position: sticky;
        top: 76px;
        z-index: 30;
        padding: 11px 20px !important;
        border-bottom: 1px solid var(--rs-line) !important;
        background: rgba(248,243,237,.97) !important;
        backdrop-filter: blur(14px);
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > div.bg-white.border-b > div {
        max-width: 920px !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main {
        overflow: visible !important;
        padding: 28px 20px 56px !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl {
        max-width: 920px !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .bg-white.rounded-2xl.border {
        border-color: var(--rs-line) !important;
        border-radius: 28px !important;
        background: #fffdfa !important;
        padding: 28px !important;
        box-shadow: 0 22px 65px rgba(66,43,28,.07) !important;
      }

      .resume-studio-body input:not([type="checkbox"]):not([type="radio"]),
      .resume-studio-body textarea,
      .resume-studio-body select {
        border-radius: 14px !important;
        border-color: rgba(75,51,38,.14) !important;
        background: #fffdfa !important;
      }

      .resume-studio-body input:not([type="checkbox"]):not([type="radio"]):focus,
      .resume-studio-body textarea:focus,
      .resume-studio-body select:focus {
        border-color: rgba(196,91,60,.48) !important;
        box-shadow: 0 0 0 4px rgba(196,91,60,.08) !important;
        outline: none !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .flex.justify-between.items-center.mt-6 {
        margin-top: 18px !important;
        border: 1px solid var(--rs-line);
        border-radius: 18px;
        background: rgba(255,253,250,.96);
        padding: 10px;
        box-shadow: 0 12px 35px rgba(57,37,25,.08);
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .flex.justify-between.items-center.mt-6 > button:last-child {
        border-radius: 13px !important;
        background: #2b211c !important;
      }

      /* Primeira utilização. */
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center.justify-center {
        min-height: calc(100vh - 76px) !important;
        padding: 36px 20px 56px !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center.justify-center > .max-w-lg {
        max-width: 720px !important;
        border: 1px solid var(--rs-line);
        border-radius: 30px;
        background: #fffdfa;
        padding: 34px;
        box-shadow: 0 24px 70px rgba(60,39,26,.09);
      }

      /* Preview: duas colunas, zero scroll interno. */
      .resume-studio-body #resume-builder-root {
        display: grid !important;
        grid-template-columns: 330px minmax(0, 1fr);
        align-items: start;
        width: 100% !important;
        height: auto !important;
        overflow: visible !important;
      }

      .resume-studio-body #resume-builder-sidebar {
        position: sticky !important;
        top: 92px !important;
        align-self: start !important;
        width: 330px !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        border: 1px solid var(--rs-line) !important;
        border-radius: 0 0 24px 0 !important;
        background: #2b211c !important;
        color: white !important;
        box-shadow: 12px 18px 42px rgba(43,33,28,.10);
      }

      .resume-studio-body #resume-builder-sidebar > div:first-child {
        border-color: rgba(255,255,255,.08) !important;
      }

      .resume-studio-body #resume-builder-sidebar > div:first-child button:first-child {
        color: rgba(255,255,255,.72) !important;
      }

      .resume-studio-body #resume-builder-sidebar > .p-5 {
        overflow: visible !important;
      }

      .resume-studio-body #resume-builder-sidebar > .p-5 > section:not(.border-violet-200) h2,
      .resume-studio-body #resume-builder-sidebar > .p-5 > section:not(.border-violet-200) label,
      .resume-studio-body #resume-builder-sidebar > .p-5 > section:not(.border-violet-200) span {
        color: rgba(255,255,255,.78);
      }

      .resume-studio-body #resume-builder-sidebar .border-stone-200.bg-white {
        border-color: rgba(255,255,255,.10) !important;
        background: rgba(255,255,255,.07) !important;
        color: white !important;
      }

      .resume-studio-body #resume-preview-area {
        display: flex !important;
        width: 100%;
        min-width: 0;
        min-height: auto !important;
        height: auto !important;
        overflow: visible !important;
        align-items: flex-start !important;
        justify-content: center !important;
        padding: 34px 28px 70px !important;
        background: #ebe4dc !important;
      }

      .resume-studio-body #resume-preview-area > div {
        flex: 0 0 auto;
        filter: drop-shadow(0 24px 42px rgba(42,29,21,.17));
      }

      @media (max-width: 980px) {
        .resume-studio-body #resume-builder-root {
          display: block !important;
        }

        .resume-studio-body #resume-builder-sidebar {
          position: relative !important;
          top: auto !important;
          width: 100% !important;
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
        }

        .resume-studio-body #resume-preview-area {
          padding: 24px 12px 56px !important;
        }
      }

      @media (max-width: 640px) {
        .resume-studio-header__inner { min-height: 68px; padding: 10px 14px; }
        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > div.bg-white.border-b { top: 68px; padding-inline: 10px !important; }
        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main { padding: 18px 10px 42px !important; }
        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .bg-white.rounded-2xl.border { padding: 18px !important; border-radius: 22px !important; }
        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center.justify-center > .max-w-lg { padding: 22px 16px; border-radius: 24px; }
      }

      @media print {
        .resume-studio-header { display: none !important; }
        .resume-studio { background: white !important; }
      }
    `}</style>
  );
}
