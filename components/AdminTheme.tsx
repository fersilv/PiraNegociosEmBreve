import React from "react";

export function AdminTheme() {
  return (
    <style>{`
      .admin-workspace {
        --admin-ink: #171714;
        --admin-paper: #f4f3ef;
        --admin-card: #fffdfa;
        --admin-line: #e5e1d9;
        --admin-muted: #78736b;
        --admin-accent: #b84d39;
      }

      .admin-workspace .admin-content {
        background:
          radial-gradient(circle at 8% 0%, rgba(184,77,57,.075), transparent 25rem),
          radial-gradient(circle at 100% 8%, rgba(23,23,20,.04), transparent 30rem),
          var(--admin-paper);
      }

      .admin-workspace .admin-page-shell {
        width: 100%;
        animation: admin-enter .32s ease-out both;
      }

      .admin-workspace .admin-page-shell > .max-w-7xl,
      .admin-workspace .admin-page-shell > .admin-standalone-page {
        max-width: 1440px !important;
      }

      .admin-workspace .admin-page-shell > .max-w-7xl > header,
      .admin-workspace .admin-standalone-page > header,
      .admin-workspace .admin-ai-page > div > header {
        position: relative;
        overflow: hidden;
        padding: clamp(1.35rem, 3vw, 2rem);
        border: 1px solid rgba(255,255,255,.06);
        border-radius: 26px;
        background:
          radial-gradient(circle at 88% 20%, rgba(204,88,67,.28), transparent 18rem),
          linear-gradient(135deg, #171714 0%, #24211d 100%);
        box-shadow: 0 22px 60px rgba(39,33,28,.12);
      }

      .admin-workspace .admin-page-shell > .max-w-7xl > header::after,
      .admin-workspace .admin-standalone-page > header::after,
      .admin-workspace .admin-ai-page > div > header::after {
        content: '';
        position: absolute;
        width: 190px;
        height: 190px;
        right: -55px;
        top: -85px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 999px;
        box-shadow: 0 0 0 28px rgba(255,255,255,.018), 0 0 0 58px rgba(255,255,255,.012);
        pointer-events: none;
      }

      .admin-workspace .admin-page-shell > .max-w-7xl > header h1,
      .admin-workspace .admin-standalone-page > header h1,
      .admin-workspace .admin-ai-page > div > header h1 {
        color: #fff !important;
        letter-spacing: -.025em;
      }

      .admin-workspace .admin-page-shell > .max-w-7xl > header > div > p:last-child,
      .admin-workspace .admin-standalone-page > header > p:last-child,
      .admin-workspace .admin-ai-page > div > header > p:last-child {
        color: rgba(255,255,255,.58) !important;
      }

      .admin-workspace .admin-page-shell > .max-w-7xl > header p:first-child,
      .admin-workspace .admin-standalone-page > header p:first-child,
      .admin-workspace .admin-ai-page > div > header p:first-child {
        color: #e9a294 !important;
      }

      .admin-workspace .admin-page-shell > .max-w-7xl > header svg {
        color: #e68876 !important;
      }

      .admin-workspace .admin-page-shell > .max-w-7xl > header a,
      .admin-workspace .admin-page-shell > .max-w-7xl > header button {
        box-shadow: 0 10px 24px rgba(0,0,0,.14);
      }

      .admin-workspace .admin-page-shell .rounded-2xl.border.border-stone-200.bg-white,
      .admin-workspace .admin-page-shell section.rounded-2xl.border.border-stone-200,
      .admin-workspace .admin-primary-surface {
        border-color: var(--admin-line) !important;
        background-color: rgba(255,253,250,.94) !important;
        box-shadow: 0 10px 30px rgba(38,33,29,.045);
      }

      .admin-workspace .admin-page-shell .shadow-sm {
        box-shadow: 0 10px 30px rgba(38,33,29,.045) !important;
      }

      .admin-workspace .admin-page-shell > .max-w-7xl > section.grid > section {
        position: relative;
        overflow: hidden;
        min-height: 132px;
        padding: 1.35rem;
        border: 1px solid var(--admin-line) !important;
        border-radius: 22px !important;
        background: rgba(255,253,250,.96) !important;
        box-shadow: 0 12px 34px rgba(38,33,29,.055) !important;
      }

      .admin-workspace .admin-page-shell > .max-w-7xl > section.grid > section::before {
        content: '';
        position: absolute;
        left: 1.35rem;
        right: 1.35rem;
        top: 0;
        height: 3px;
        border-radius: 0 0 999px 999px;
        background: linear-gradient(90deg, #cc5843, #dfa08f);
        opacity: .9;
      }

      .admin-workspace .admin-page-shell > .max-w-7xl > section.grid > section p:first-child {
        font-size: clamp(1.8rem, 4vw, 2.35rem) !important;
        letter-spacing: -.045em;
      }

      .admin-workspace .admin-page-shell table {
        border-collapse: separate;
        border-spacing: 0;
      }

      .admin-workspace .admin-page-shell thead {
        background: #f7f5f1 !important;
        color: #8a847a !important;
      }

      .admin-workspace .admin-page-shell thead th {
        padding-top: .9rem !important;
        padding-bottom: .9rem !important;
        font-size: .67rem !important;
        letter-spacing: .085em !important;
      }

      .admin-workspace .admin-page-shell tbody tr {
        transition: background-color .18s ease, transform .18s ease;
      }

      .admin-workspace .admin-page-shell tbody tr:hover {
        background: rgba(166,63,45,.035);
      }

      .admin-workspace .admin-page-shell input:not([type='checkbox']):not([type='radio']),
      .admin-workspace .admin-page-shell select,
      .admin-workspace .admin-page-shell textarea {
        border-color: #ddd8cf !important;
        border-radius: 13px !important;
        background: rgba(255,255,255,.96) !important;
        transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
      }

      .admin-workspace .admin-page-shell input:not([type='checkbox']):not([type='radio']):focus,
      .admin-workspace .admin-page-shell select:focus,
      .admin-workspace .admin-page-shell textarea:focus {
        border-color: rgba(166,63,45,.6) !important;
        box-shadow: 0 0 0 4px rgba(166,63,45,.08) !important;
        outline: none !important;
      }

      .admin-workspace .admin-page-shell button,
      .admin-workspace .admin-page-shell a {
        transition: transform .16s ease, box-shadow .16s ease, background-color .16s ease, color .16s ease;
      }

      .admin-workspace .admin-page-shell button:active,
      .admin-workspace .admin-page-shell a:active {
        transform: translateY(1px);
      }

      .admin-workspace .admin-ai-page > div.space-y-6 > section,
      .admin-workspace .admin-ai-page > div.space-y-6 > div.grid > section {
        border-radius: 22px !important;
      }

      .admin-workspace .admin-ai-page > div.space-y-6 > section:first-of-type {
        position: relative;
        overflow: hidden;
        box-shadow: 0 12px 34px rgba(38,33,29,.055);
      }

      .admin-workspace .admin-primary-surface > div > section,
      .admin-workspace .admin-primary-surface form.rounded-2xl {
        background: #fbfaf7;
      }

      .admin-workspace .admin-page-shell pre {
        border: 1px solid rgba(255,255,255,.06);
        border-radius: 16px !important;
        box-shadow: inset 0 1px rgba(255,255,255,.04);
      }

      .admin-workspace .admin-page-shell [role='dialog'] > div {
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 24px !important;
        box-shadow: 0 28px 90px rgba(0,0,0,.24) !important;
      }

      .admin-workspace .admin-page-shell .bg-stone-50 {
        background-color: #f7f5f1;
      }

      .admin-workspace .admin-page-shell .text-stone-500 {
        color: #777169;
      }

      .admin-workspace .admin-page-shell .text-stone-900 {
        color: #211f1c;
      }

      @keyframes admin-enter {
        from { opacity: 0; transform: translateY(7px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @media (max-width: 767px) {
        .admin-workspace .admin-content {
          padding: .9rem .9rem 6.2rem !important;
        }

        .admin-workspace .admin-page-shell > .max-w-7xl > header,
        .admin-workspace .admin-standalone-page > header,
        .admin-workspace .admin-ai-page > div > header {
          padding: 1.25rem;
          border-radius: 22px;
        }

        .admin-workspace .admin-page-shell > .max-w-7xl > header h1,
        .admin-workspace .admin-standalone-page > header h1,
        .admin-workspace .admin-ai-page > div > header h1 {
          font-size: 1.65rem !important;
        }

        .admin-workspace .admin-page-shell .overflow-x-auto {
          scrollbar-width: thin;
        }

        .admin-workspace .admin-page-shell > .max-w-7xl > section.grid > section {
          min-height: 112px;
        }
      }
    `}</style>
  );
}
