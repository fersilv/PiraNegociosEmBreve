import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAiStatus } from "../hooks/useAiStatus";

function money(cents: number | null) {
  if (!cents || cents <= 0) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function setText(element: Element | null, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
}

function setManagedInlineText(element: HTMLElement, value: string, key: string) {
  Array.from(element.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      node.textContent = "";
    }
  });

  let managed = element.querySelector<HTMLElement>(`[data-${key}="true"]`);
  if (!managed) {
    managed = document.createElement("span");
    managed.dataset[key] = "true";
    const input = element.querySelector("input");
    if (input) element.insertBefore(managed, input);
    else element.appendChild(managed);
  }
  if (managed.textContent !== value) managed.textContent = value;
}

function findImportEntryCard() {
  const managed = document.querySelector<HTMLElement>("[data-resume-import-entry-card='true']");
  if (managed) return managed;

  const heading = Array.from(document.querySelectorAll<HTMLElement>("h3")).find((element) => {
    const text = (element.textContent || "").trim();
    return text.includes("Já tem documentos da sua trajetória?")
      || text.includes("1ª importação com IA grátis")
      || text.includes("Importar novos documentos com IA");
  });
  const card = heading?.parentElement || null;
  if (card) card.dataset.resumeImportEntryCard = "true";
  return card;
}

function hideRedundantDocumentBaseCard() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>("#resume-builder-sidebar section"));
  sections.forEach((section) => {
    const text = section.textContent || "";
    if (!text.includes("Documento-base")) return;
    if (!text.includes("Importar documento-base") && !text.includes("Gerenciar documento-base")) return;
    section.dataset.resumeImportDuplicate = "true";
    section.style.setProperty("display", "none", "important");
  });
}

function findImportCreditCard() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>("p")).find(
    (element) => (element.textContent || "").trim() === "Novas importações por IA",
  );
  return heading?.parentElement || null;
}

export function ResumeImportEntitlementOrchestrator() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useAiStatus();
  const onResumePage = location.pathname === "/user/curriculo";
  const onPaymentsPage = location.pathname === "/user/pagamentos";
  const priceLabel = money(status.resumeImportPriceCents);

  const canImportNow = useMemo(
    () => Boolean(
      status.freeResumeImportAvailable
        || status.resumeImportCredits > 0
        || status.paymentAccessOverride
        || (status.resumeImportProductEnabled && !status.resumeImportPaymentRequired),
    ),
    [
      status.freeResumeImportAvailable,
      status.paymentAccessOverride,
      status.resumeImportCredits,
      status.resumeImportPaymentRequired,
      status.resumeImportProductEnabled,
    ],
  );

  useEffect(() => {
    if (!onResumePage || status.loading) return;
    const wantsImport = new URLSearchParams(location.search).get("import") === "1";
    if (!wantsImport || canImportNow) return;

    if (status.resumeImportPaymentRequired && status.resumeImportProductEnabled) {
      navigate("/user/pagamentos", { replace: true });
      return;
    }
    navigate("/user/curriculo", { replace: true });
  }, [
    canImportNow,
    location.search,
    navigate,
    onResumePage,
    status.loading,
    status.resumeImportPaymentRequired,
    status.resumeImportProductEnabled,
  ]);

  useEffect(() => {
    if (!onResumePage && !onPaymentsPage) return;

    let disposed = false;
    let frame: number | null = null;

    const syncResumePage = () => {
      hideRedundantDocumentBaseCard();

      const card = findImportEntryCard();
      if (card) {
        const heading = card.querySelector<HTMLElement>("h3");
        const description = heading?.nextElementSibling as HTMLElement | null;
        const label = card.querySelector<HTMLElement>("label");
        const input = label?.querySelector<HTMLInputElement>("input[type='file']") || null;

        let badge = card.querySelector<HTMLElement>("[data-resume-import-entitlement-badge='true']");
        if (!badge && heading) {
          badge = document.createElement("p");
          badge.dataset.resumeImportEntitlementBadge = "true";
          badge.className = "mb-1 text-[10px] font-black uppercase tracking-[.14em] text-violet-500";
          card.insertBefore(badge, heading);
        }

        const firstFree = status.freeResumeImportAvailable;
        const hasCredit = status.resumeImportCredits > 0;
        const included = status.paymentAccessOverride;
        const paywall = !status.loading && !canImportNow && status.resumeImportPaymentRequired && status.resumeImportProductEnabled;
        const unavailable = !status.loading && !canImportNow && !paywall;

        setText(
          badge,
          status.loading
            ? "Verificando disponibilidade"
            : firstFree
              ? "Primeira importação gratuita"
              : hasCredit
                ? `${status.resumeImportCredits} crédito(s) disponível(is)`
                : included
                  ? "Incluído no seu acesso"
                  : "Importação inteligente",
        );

        if (heading) {
          setManagedInlineText(
            heading,
            firstFree ? "1ª importação com IA grátis" : "Importar novos documentos com IA",
            "resumeImportHeading",
          );
        }

        if (description) {
          setText(
            description,
            firstFree
              ? "Word, PDF, texto, RTF e imagens podem ser combinados. A IA extrai os dados e aplica ao perfil para você revisar. Esta primeira importação é gratuita; depois, cada nova importação usa 1 crédito."
              : hasCredit
                ? `Você já usou a importação gratuita e tem ${status.resumeImportCredits} crédito(s). Cada nova organização por IA consome 1 crédito.`
                : included
                  ? "A importação com IA está incluída no seu acesso atual. Você continua revisando tudo antes de salvar."
                  : paywall
                    ? `Sua primeira importação gratuita já foi usada. Uma nova importação requer 1 crédito${priceLabel ? `, disponível por ${priceLabel}` : ""}.`
                    : "Sua primeira importação gratuita já foi usada e novas importações estão temporariamente indisponíveis.",
          );
        }

        if (label) {
          label.dataset.resumeImportAction = status.loading
            ? "disabled"
            : canImportNow
              ? "open"
              : paywall
                ? "pay"
                : "disabled";
          label.classList.toggle("opacity-50", status.loading || unavailable);
          label.classList.toggle("cursor-not-allowed", status.loading || unavailable);
          label.classList.toggle("cursor-pointer", !(status.loading || unavailable));
          setManagedInlineText(
            label,
            status.loading
              ? "Verificando..."
              : firstFree
                ? "Importar documentos grátis"
                : hasCredit
                  ? "Usar 1 crédito"
                  : included
                    ? "Importar documentos"
                    : paywall
                      ? `Comprar nova importação${priceLabel ? ` · ${priceLabel}` : ""}`
                      : "Novas importações indisponíveis",
            "resumeImportButtonText",
          );
        }

        if (input) {
          input.tabIndex = -1;
          input.setAttribute("aria-hidden", "true");
        }
      }

      const modal = document.querySelector<HTMLElement>(".resume-import-modal");
      if (modal && canImportNow) {
        const title = modal.querySelector<HTMLElement>("h2");
        const description = title?.nextElementSibling as HTMLElement | null;
        const firstFree = status.freeResumeImportAvailable;
        const hasCredit = status.resumeImportCredits > 0;

        setText(
          title,
          firstFree
            ? "1ª importação com IA grátis"
            : hasCredit
              ? "Usar crédito de importação"
              : "Importar documentos com IA",
        );
        setText(
          description,
          firstFree
            ? "Word, PDF, texto, RTF e imagens podem ser combinados. A IA extrai os dados e aplica ao perfil para você revisar. Esta primeira importação é gratuita; depois, cada nova importação usa 1 crédito."
            : hasCredit
              ? `Word, PDF, texto, RTF e imagens podem ser combinados. Esta ação usa 1 dos seus ${status.resumeImportCredits} crédito(s) de importação e altera apenas o rascunho.`
              : "Word, PDF, texto, RTF e imagens podem ser combinados. Esta importação está incluída no seu acesso e altera apenas o rascunho.",
        );

        const action = Array.from(modal.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
          (button.textContent || "").includes("Importar e aplicar"),
        );
        if (action) {
          setManagedInlineText(
            action,
            firstFree ? "Importar grátis" : hasCredit ? "Usar 1 crédito e importar" : "Importar e organizar",
            "resumeImportModalAction",
          );
        }
      }
    };

    const syncPaymentsPage = () => {
      const card = findImportCreditCard();
      if (!card) return;

      let action = card.querySelector<HTMLButtonElement>("[data-resume-import-credit-action='true']");
      const shouldShow = !status.loading && (status.freeResumeImportAvailable || status.resumeImportCredits > 0 || status.paymentAccessOverride);

      if (!shouldShow) {
        action?.remove();
        return;
      }

      if (!action) {
        action = document.createElement("button");
        action.type = "button";
        action.dataset.resumeImportCreditAction = "true";
        action.className = "mt-3 inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-black text-white hover:bg-violet-700";
        card.appendChild(action);
      }
      const nextLabel = status.freeResumeImportAvailable
        ? "Usar 1ª importação grátis"
        : status.resumeImportCredits > 0
          ? `Usar crédito de importação (${status.resumeImportCredits})`
          : "Importar documentos";
      if (action.textContent !== nextLabel) action.textContent = nextLabel;
    };

    const sync = () => {
      if (disposed) return;
      if (onResumePage) syncResumePage();
      if (onPaymentsPage) syncPaymentsPage();
    };

    const scheduleSync = () => {
      if (disposed || frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        sync();
      });
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleSync();

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const entry = target?.closest<HTMLElement>("[data-resume-import-action]");
      if (entry) {
        const action = entry.dataset.resumeImportAction;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (action === "open") navigate("/user/curriculo?import=1");
        else if (action === "pay") navigate("/user/pagamentos");
        return;
      }

      const creditAction = target?.closest<HTMLElement>("[data-resume-import-credit-action='true']");
      if (creditAction) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        navigate("/user/curriculo?import=1");
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [
    canImportNow,
    navigate,
    onPaymentsPage,
    onResumePage,
    priceLabel,
    status.freeResumeImportAvailable,
    status.loading,
    status.paymentAccessOverride,
    status.resumeImportCredits,
    status.resumeImportPaymentRequired,
    status.resumeImportProductEnabled,
  ]);

  return null;
}
