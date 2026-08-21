import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { ResumeBuilderPage } from "./ResumeBuilderPage";

export function ResumeBuilderStudio() {
  return (
    <div className="resume-studio -m-4 sm:-m-6 md:-m-8 md:-mb-10">
      <ResumeStudioTheme />

      <div className="resume-studio-shell">
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
                Dados salvos no seu perfil
              </span>
              <span className="resume-studio-trust">
                <WandSparkles className="h-3.5 w-3.5" />
                Editor inteligente
              </span>
            </div>
          </div>
        </header>

        <div className="resume-studio-body">
          <ResumeBuilderPage />
        </div>
      </div>
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
        --rs-surface: rgba(255, 253, 249, .88);
        --rs-accent: #c45b3c;
        min-height: calc(100vh - 72px);
        background:
          radial-gradient(circle at 15% -5%, rgba(211, 126, 87, .18), transparent 29rem),
          radial-gradient(circle at 90% 10%, rgba(96, 68, 51, .09), transparent 31rem),
          linear-gradient(180deg, #f7f1ea 0%, #f2ebe3 52%, #f7f3ee 100%);
        color: var(--rs-ink);
      }

      .resume-studio-shell {
        min-height: calc(100vh - 72px);
      }

      .resume-studio-header {
        position: sticky;
        top: 72px;
        z-index: 24;
        border-bottom: 1px solid var(--rs-line);
        background: rgba(249, 244, 238, .86);
        backdrop-filter: blur(24px);
        box-shadow: 0 1px 0 rgba(255,255,255,.72) inset;
      }

      .resume-studio-header__inner {
        display: flex;
        min-height: 78px;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 13px 24px;
      }

      .resume-studio-back {
        display: inline-flex;
        width: 40px;
        height: 40px;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--rs-line);
        border-radius: 15px;
        background: rgba(255,253,249,.76);
        color: #5e5048;
        box-shadow: 0 8px 25px rgba(65,43,29,.06);
        transition: transform .18s ease, background .18s ease;
      }

      .resume-studio-back:hover { transform: translateY(-1px); background: #fffdfa; }

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
        background: rgba(255,253,249,.64);
        color: #78695f;
        font-size: 10px;
        font-weight: 700;
      }

      /* The builder already lives inside the Career workspace. Remove its old nested app chrome. */
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > header {
        display: none !important;
      }

      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col,
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center,
      .resume-studio-body #resume-builder-root {
        min-height: auto !important;
        background: transparent !important;
      }

      /* Wizard navigation */
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > div.bg-white.border-b {
        position: sticky;
        top: 150px;
        z-index: 20;
        border-bottom: 1px solid var(--rs-line) !important;
        background: rgba(247,241,234,.84) !important;
        padding: 12px 24px !important;
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

      /* Main editor canvas */
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main {
        overflow: visible !important;
        padding: 28px 24px 46px !important;
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

      /* Internal editor controls */
      .resume-studio-body input:not([type="checkbox"]):not([type="radio"]),
      .resume-studio-body textarea,
      .resume-studio-body select {
        border-radius: 15px !important;
        border-color: rgba(75,51,38,.13) !important;
        background-color: rgba(255,253,249,.9) !important;
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

      .resume-studio-body label { color: #655850; }

      /* Existing editors and summary cards */
      .resume-studio-body .rounded-2xl.border.border-stone-200.bg-stone-50,
      .resume-studio-body .rounded-2xl.border.border-stone-200.bg-stone-50\/70 {
        border-color: rgba(75,51,38,.10) !important;
        background: rgba(246,239,232,.66) !important;
      }

      /* Skills must stay simple. Detailed provenance remains internal, not a mandatory matrix. */
      .resume-studio-body .rounded-2xl.border.border-stone-200.bg-stone-50\/70.p-4:has(h3) {
        display: none !important;
      }

      /* Bottom wizard actions */
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .flex.justify-between.items-center.mt-6 {
        position: sticky;
        bottom: 14px;
        z-index: 18;
        margin-top: 18px !important;
        border: 1px solid var(--rs-line);
        border-radius: 20px;
        background: rgba(255,253,249,.84);
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

      /* First-use screen */
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center.justify-center {
        min-height: calc(100vh - 150px) !important;
        padding: 38px 24px 60px !important;
      }
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center.justify-center > .max-w-lg {
        max-width: 760px !important;
        border: 1px solid var(--rs-line);
        border-radius: 34px;
        background: rgba(255,253,249,.84);
        padding: 36px;
        box-shadow: 0 28px 90px rgba(60,39,26,.10);
        backdrop-filter: blur(22px);
      }
      .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center.justify-center .w-20.h-20 {
        background: #2b211c !important;
        color: #f0c2a9 !important;
        box-shadow: 0 16px 42px rgba(43,33,28,.16);
      }

      /* Preview studio */
      .resume-studio-body #resume-builder-root {
        min-height: calc(100vh - 150px) !important;
        border-top: 1px solid var(--rs-line);
      }
      .resume-studio-body #resume-builder-sidebar {
        width: min(390px, 100%) !important;
        border-color: rgba(255,255,255,.07) !important;
        background: #2b211c !important;
        color: white;
      }
      .resume-studio-body #resume-builder-sidebar > div:first-child {
        border-color: rgba(255,255,255,.08) !important;
      }
      .resume-studio-body #resume-builder-sidebar > div:first-child button:first-child {
        color: rgba(255,255,255,.62) !important;
      }
      .resume-studio-body #resume-builder-sidebar > .p-5 {
        padding: 22px !important;
      }
      .resume-studio-body #resume-builder-sidebar > .p-5 > section:not(.border-violet-200) h2,
      .resume-studio-body #resume-builder-sidebar > .p-5 > section:not(.border-violet-200) label,
      .resume-studio-body #resume-builder-sidebar > .p-5 > section:not(.border-violet-200) span {
        color: rgba(255,255,255,.76);
      }
      .resume-studio-body #resume-builder-sidebar .border-stone-200.bg-white {
        border-color: rgba(255,255,255,.10) !important;
        background: rgba(255,255,255,.07) !important;
        color: white !important;
      }
      .resume-studio-body #resume-preview-area {
        background:
          radial-gradient(circle at 80% 10%, rgba(196,91,60,.11), transparent 24rem),
          #e9e2da !important;
        padding: 32px !important;
      }
      .resume-studio-body #resume-preview-area > div {
        filter: drop-shadow(0 30px 45px rgba(42,29,21,.18));
      }

      @media (max-width: 767px) {
        .resume-studio-header { top: 68px; }
        .resume-studio-header__inner { min-height: 70px; padding: 10px 14px; }
        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > div.bg-white.border-b { top: 138px; padding-inline: 12px !important; }
        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main { padding: 20px 12px 38px !important; }
        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col > main > .max-w-2xl > .bg-white.rounded-2xl.border { padding: 18px !important; border-radius: 24px !important; }
        .resume-studio-body > .min-h-screen.bg-stone-50.flex.flex-col.items-center.justify-center > .max-w-lg { padding: 24px 18px; border-radius: 26px; }
        .resume-studio-body #resume-builder-root { flex-direction: column !important; }
        .resume-studio-body #resume-builder-sidebar { position: relative !important; top: auto !important; height: auto !important; }
        .resume-studio-body #resume-preview-area { padding: 20px 10px !important; min-height: 70vh; }
      }

      @media (prefers-reduced-motion: no-preference) {
        .resume-studio-body > * { animation: rsIn .34s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes rsIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      }
    `}</style>
  );
}
