import React from "react";
import { ResumeScorePaymentBridge } from "./payments/ResumeScorePaymentBridge";

export function UserTheme() {
  return (
    <>
      <ResumeScorePaymentBridge />
      <style>{`
        .user-workspace {
          --user-ink: #201813;
          --user-muted: #746a62;
          --user-line: rgba(73, 52, 40, 0.11);
          --user-surface: rgba(255, 253, 249, 0.88);
          --user-accent: #c45b3c;
          background:
            radial-gradient(circle at 12% 8%, rgba(204, 112, 74, 0.13), transparent 28rem),
            radial-gradient(circle at 88% 12%, rgba(112, 77, 54, 0.08), transparent 30rem),
            linear-gradient(180deg, #f8f4ee 0%, #f3ede6 46%, #f6f2ed 100%);
          color: var(--user-ink);
        }

        .user-workspace .user-content {
          position: relative;
        }

        .user-workspace .user-content::before {
          content: "";
          position: fixed;
          inset: 72px 0 auto 288px;
          height: 180px;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(255,255,255,0.34), transparent);
          z-index: 0;
        }

        .user-workspace .user-content > * {
          position: relative;
          z-index: 1;
        }

        .user-workspace .user-glass {
          background: rgba(255, 253, 249, 0.72);
          border: 1px solid rgba(73, 52, 40, 0.10);
          box-shadow: 0 24px 70px rgba(58, 37, 25, 0.08);
          backdrop-filter: blur(20px);
        }

        .user-workspace .user-elevated {
          box-shadow:
            0 1px 0 rgba(255,255,255,0.8) inset,
            0 20px 60px rgba(64, 42, 28, 0.09);
        }

        .user-workspace .user-content .bg-white {
          background-color: rgba(255, 253, 249, 0.82) !important;
          backdrop-filter: blur(16px);
        }

        .user-workspace .user-content .border-stone-200 {
          border-color: rgba(73, 52, 40, 0.11) !important;
        }

        .user-workspace .user-content .bg-stone-50 {
          background-color: rgba(248, 243, 237, 0.78) !important;
        }

        .user-workspace .user-content .shadow-sm,
        .user-workspace .user-content .shadow-md {
          box-shadow: 0 18px 55px rgba(61, 40, 28, 0.08) !important;
        }

        .user-workspace .user-content .rounded-3xl,
        .user-workspace .user-content .rounded-2xl {
          border-color: rgba(73, 52, 40, 0.10);
        }

        .user-workspace input:not([type="checkbox"]):not([type="radio"]),
        .user-workspace textarea,
        .user-workspace select {
          border-radius: 16px;
          border-color: rgba(73, 52, 40, 0.13);
          background-color: rgba(255, 253, 249, 0.86);
          transition: border-color .18s ease, box-shadow .18s ease, background-color .18s ease;
        }

        .user-workspace input:not([type="checkbox"]):not([type="radio"]):focus,
        .user-workspace textarea:focus,
        .user-workspace select:focus {
          border-color: rgba(196, 91, 60, 0.48);
          background-color: #fffdfa;
          box-shadow: 0 0 0 4px rgba(196, 91, 60, 0.09);
          outline: none;
        }

        .user-workspace table {
          border-collapse: separate;
          border-spacing: 0;
        }

        .user-workspace ::selection {
          background: rgba(196, 91, 60, 0.20);
          color: #201813;
        }

        @media (max-width: 767px) {
          .user-workspace {
            background:
              radial-gradient(circle at 18% 4%, rgba(204, 112, 74, 0.10), transparent 19rem),
              linear-gradient(180deg, #f8f3ed 0%, #f4eee7 100%);
          }

          .user-workspace .user-content {
            padding: 14px 14px calc(92px + env(safe-area-inset-bottom)) !important;
          }

          .user-workspace .user-content::before {
            inset-inline: 0;
            height: 112px;
            opacity: .62;
          }

          .user-workspace > div > header.sticky {
            min-height: 64px;
            height: 64px;
            padding-inline: 14px;
          }

          .user-workspace > nav.fixed.inset-x-0.bottom-0 {
            background: rgba(43, 33, 28, .985) !important;
            border-color: rgba(255,255,255,.08) !important;
            padding-top: 8px;
            padding-bottom: calc(8px + env(safe-area-inset-bottom));
            backdrop-filter: blur(20px);
          }

          .user-workspace > nav.fixed.inset-x-0.bottom-0 a:not([aria-current="page"]) {
            color: rgba(255,255,255,.56) !important;
          }

          .user-workspace > nav.fixed.inset-x-0.bottom-0 a[aria-current="page"] {
            color: #f2c5ad !important;
            background: rgba(255,255,255,.07) !important;
          }

          .user-workspace > nav.fixed.inset-x-0.bottom-0 a svg {
            width: 19px;
            height: 19px;
          }

          .user-workspace > nav.fixed.inset-x-0.bottom-0 a span {
            font-size: 10px;
            line-height: 1.15;
          }
        }

        @media (prefers-reduced-motion: no-preference) {
          .user-workspace .user-content > * {
            animation: userPremiumIn .36s cubic-bezier(.2,.7,.2,1) both;
          }
          @keyframes userPremiumIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        }
      `}</style>
    </>
  );
}
