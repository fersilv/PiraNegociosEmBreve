import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import { ResumeBuilderPage } from "./ResumeBuilderPage";

export function ResumeBuilderStudio() {
  return (
    <div className="resume-studio">
      <ResumeStudioTheme />

      <header className="resume-studio-header">
        <div className="resume-studio-header__inner">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/user"
              className="resume-studio-back"
              aria-label="Voltar ao meu espaço"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="resume-studio-kicker">PiraNegócios Career</span>
                <span className="resume-studio-dot" />
                <span className="resume-studio-kicker resume-studio-kicker--muted">
                  Resume Studio
                </span>
              </div>
              <h1 className="truncate font-serif text-xl font-bold text-[#241914] sm:text-2xl">
                Seu currículo profissional
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="resume-studio-trust">
              <ShieldCheck className="h-3.5 w-3.5" />
              Integrado ao seu perfil
            </span>
            <span className="resume-studio-trust">
              <WandSparkles className="h-3.5 w-3.5" />
              Editor inteligente
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
        --rs-muted: #74675f;
        --rs-line: rgba(75, 51, 38, .12);
        --rs-surface: rgba(255, 253, 249, .92);
        --rs-accent: #c45b3c;
        min-height: 100vh;
        background:
          radial-gradient(circle at 12% 0%, rgba(211, 126, 87, .16), transparent 28rem),
          radial-gradient(circle at 90% 8%, rgba(96, 68, 51, .08), transparent 30rem),
          linear-gradient(180deg, #f8f3ed 0%, #f2ebe3 54%, #f7f3ee 100%);
        color: var(--rs-ink);
      }

      .resume-studio-header {
        position: sticky;
        top: 0;
        z-index: 40;
        border-bottom: 1px solid var(--rs-line);
        background: rgba(249, 244, 238, .94);
        backdrop-filter: blur(24px);
        box-shadow: 0 1px 0 rgba(255,255,255,.75) inset;
      }

      .resume-studio-header__inner {
        display: flex;
        min-height: 76px;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        max-width: 1600px;
        margin: 0 auto;
        padding: 12px 24px;
      }

      .resume-studio-back {
        display: inline-flex;
        width: 42px;
        height: 42px;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--rs-line);
        border-radius: 15px;
        background: rgba(255,253,249,.82);
        color: #5e5048;
        box-shadow: 0 8px 25px rgba(65,43,29,.06);
        transition: transform .18s ease, background .18s ease;
      }

      .resume-studio-back:hover {
        transform: translateY(-1px);
        background: #fffdfa;
      }

      .resume-studio-kicker {
        font-size: 9px;
        font-weight: 800;
        letter-spacing: .18em;
        text-transform: uppercase;
        color: #b55236;
      }

      .resume-studio-kicker--muted { color: #9b8b81; }
      .resume-studio-dot { width: 3px; height: 3px; border-radius: 99px; background: #cabbb0; }

      .resume-studio-trust {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 9px 12px;
        border: 1px solid var(--rs-line);
        border-radius: 999px;
        background: rgba(255,253,249,.72);
        color: #78695f;
        font-size: 10px;
        font-weight: 700;
      }

      /* O builder já está dentro do Studio. Escondemos apenas o chrome legado. */
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > header {
        display: none !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col,
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center,
      .resume-studio-body #resume-builder-root {
        min-height: auto !important;
        background: transparent !important;
      }

      /* Wizard: uma única rolagem da página. */
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > div.bg-white.border-b {
        position: sticky;
        top: 76px;
        z-index: 30;
        border-bottom: 1px solid var(--rs-line) !important;
        background: rgba(247,241,234,.94) !important;
        padding: 11px 24px !important;
        backdrop-filter: blur(18px);
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > div.bg-white.border-b > div {
        max-width: 980px !important;
        gap: 5px !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > div.bg-white.border-b button {
        min-height: 38px;
        border: 1px solid rgba(75,51,38,.08);
        padding: 8px 12px !important;
        border-radius: 14px !important;
        box-shadow: 0 6px 18px rgba(65,43,29,.035);
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main {
        overflow: visible !important;
        padding: 28px 24px 56px !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl {
        max-width: 920px !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .flex.items-center.gap-3.mb-6 {
        margin-bottom: 18px !important;
        padding: 0 4px;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .flex.items-center.gap-3.mb-6 > div:first-child {
        width: 48px !important;
        height: 48px !important;
        border-radius: 18px !important;
        background: #2b211c !important;
        color: #f1c2aa !important;
        box-shadow: 0 13px 35px rgba(43,33,28,.16);
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .bg-white.rounded-2xl.border {
        border-color: var(--rs-line) !important;
        border-radius: 30px !important;
        background: var(--rs-surface) !important;
        padding: 28px !important;
        box-shadow: 0 24px 75px rgba(66,43,28,.075), 0 1px 0 rgba(255,255,255,.88) inset !important;
        backdrop-filter: blur(18px);
      }

      .resume-studio-body input:not([type="checkbox"]):not([type="radio"]),
      .resume-studio-body textarea,
      .resume-studio-body select {
        border-radius: 15px !important;
        border-color: rgba(75,51,38,.13) !important;
        background-color: rgba(255,253,249,.92) !important;
        box-shadow: 0 1px 0 rgba(255,255,255,.76) inset;
        transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
      }

      .resume-studio-body input:not([type="checkbox"]):not([type="radio"]):focus,
      .resume-studio-body textarea:focus,
      .resume-studio-body select:focus {
        border-color: rgba(196,91,60,.48) !important;
        background: #fffdfa !important;
        box-shadow: 0 0 0 4px rgba(196,91,60,.09) !important;
        outline: none !important;
      }

      .resume-studio-body .rounded-2xl.border.border-stone-200.bg-stone-50,
      .resume-studio-body .rounded-2xl.border.border-stone-200.bg-stone-50\/70 {
        border-color: rgba(75,51,38,.10) !important;
        background: rgba(246,239,232,.66) !important;
      }

      /* A matriz habilidade x origem não faz parte do fluxo principal. */
      .resume-studio-body .rounded-2xl.border.border-stone-200.bg-stone-50\/70.p-4:has(h3) {
        display: none !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .flex.justify-between.items-center.mt-6 {
        position: sticky;
        bottom: 14px;
        z-index: 18;
        margin-top: 18px !important;
        border: 1px solid var(--rs-line);
        border-radius: 20px;
        background: rgba(255,253,249,.9);
        padding: 10px;
        box-shadow: 0 18px 55px rgba(57,37,25,.12);
        backdrop-filter: blur(20px);
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .flex.justify-between.items-center.mt-6 > button:last-child {
        min-height: 44px;
        border-radius: 14px !important;
        background: #2b211c !important;
        padding-inline: 20px !important;
        box-shadow: 0 10px 28px rgba(43,33,28,.18) !important;
      }

      /* Primeira utilização. */
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center.justify-center {
        min-height: calc(100vh - 76px) !important;
        padding: 38px 24px 60px !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center.justify-center > .max-w-lg {
        max-width: 760px !important;
        border: 1px solid var(--rs-line);
        border-radius: 34px;
        background: rgba(255,253,249,.88);
        padding: 36px;
        box-shadow: 0 28px 90px rgba(60,39,26,.10);
        backdrop-filter: blur(22px);
      }

      /* Preview: Control Deck horizontal + documento. Sem scroll interno. */
      .resume-studio:has(#resume-builder-root) .resume-studio-header {
        position: relative;
      }

      .resume-studio-body #resume-builder-root {
        display: block !important;
        width: 100% !important;
        min-height: 0 !important;
        height: auto !important;
        overflow: visible !important;
        border: 0 !important;
      }

      .resume-studio-body #resume-builder-sidebar {
        position: relative !important;
        top: auto !important;
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        border: 0 !important;
        border-bottom: 1px solid var(--rs-line) !important;
        background: rgba(247,241,234,.96) !important;
        color: var(--rs-ink) !important;
        box-shadow: 0 18px 50px rgba(64,42,28,.055);
        z-index: 20;
      }

      .resume-studio-body #resume-builder-sidebar > div:first-child {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        max-width: 1500px;
        margin: 0 auto;
        padding: 12px 24px !important;
        border-color: var(--rs-line) !important;
        background: transparent !important;
      }

      .resume-studio-body #resume-builder-sidebar > div:first-child button:first-child {
        color: #695b52 !important;
      }

      .resume-studio-body #resume-builder-sidebar > div:first-child button:last-child {
        min-height: 42px;
        border-radius: 13px !important;
        background: #2b211c !important;
        padding-inline: 16px !important;
        color: white !important;
        box-shadow: 0 10px 25px rgba(43,33,28,.15) !important;
      }

      .resume-studio-body #resume-builder-sidebar > .p-5 {
        display: grid !important;
        grid-template-columns: minmax(270px, 1.25fr) repeat(3, minmax(190px, 1fr));
        align-items: start;
        gap: 14px !important;
        max-width: 1500px;
        margin: 0 auto;
        padding: 16px 24px 20px !important;
        overflow: visible !important;
      }

      .resume-studio-body #resume-builder-sidebar > .p-5 > section {
        min-width: 0;
        margin: 0 !important;
        border: 1px solid var(--rs-line);
        border-radius: 22px !important;
        background: rgba(255,253,249,.88);
        padding: 16px !important;
        box-shadow: 0 10px 28px rgba(65,43,29,.045);
      }

      .resume-studio-body #resume-builder-sidebar > .p-5 > section h2,
      .resume-studio-body #resume-builder-sidebar > .p-5 > section label,
      .resume-studio-body #resume-builder-sidebar > .p-5 > section span {
        color: inherit;
      }

      .resume-studio-body #resume-builder-sidebar .border-stone-200.bg-white {
        border-color: rgba(75,51,38,.11) !important;
        background: rgba(255,255,255,.82) !important;
        color: #43372f !important;
      }

      .resume-studio-body #resume-preview-area {
        width: 100%;
        min-width: 0;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        align-items: flex-start !important;
        justify-content: center !important;
        background:
          radial-gradient(circle at 80% 6%, rgba(196,91,60,.10), transparent 28rem),
          linear-gradient(145deg, #eee8e1, #e5ddd4) !important;
        padding: 42px 28px 72px !important;
      }

      .resume-studio-body #resume-preview-area > div {
        flex: 0 0 auto;
        filter: drop-shadow(0 28px 48px rgba(42,29,21,.19));
      }

      @media (max-width: 1180px) {
        .resume-studio-body #resume-builder-sidebar > .p-5 {
          grid-template-columns: repeat(2, minmax(260px, 1fr));
        }
      }

      @media (max-width: 720px) {
        .resume-studio-header__inner {
          min-height: 68px;
          padding: 9px 14px;
        }

        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > div.bg-white.border-b {
          top: 68px;
          padding-inline: 12px !important;
        }

        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main {
          padding: 20px 12px 40px !important;
        }

        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .bg-white.rounded-2xl.border {
          padding: 18px !important;
          border-radius: 24px !important;
        }

        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center.justify-center > .max-w-lg {
          padding: 24px 18px;
          border-radius: 26px;
        }

        .resume-studio-body #resume-builder-sidebar > div:first-child {
          padding: 10px 12px !important;
        }

        .resume-studio-body #resume-builder-sidebar > .p-5 {
          display: block !important;
          padding: 12px !important;
        }

        .resume-studio-body #resume-builder-sidebar > .p-5 > section + section {
          margin-top: 10px !important;
        }

        .resume-studio-body #resume-preview-area {
          padding: 22px 8px 46px !important;
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .resume-studio-body > * {
          animation: rsIn .32s cubic-bezier(.2,.7,.2,1) both;
        }
        @keyframes rsIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      }
    `}</style>
  );
}
