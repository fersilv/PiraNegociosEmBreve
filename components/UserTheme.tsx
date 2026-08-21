import React from "react";

export function UserTheme() {
  return (
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
        inset: 68px 0 auto 288px;
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
        .user-workspace .user-content::before {
          inset-inline: 0;
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
  );
}
