import React, { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Mail, MessageCircle } from "lucide-react";
import { applicationUrlLabel, safeApplicationUrl } from "../lib/jobApplication";

type Props = {
  title: string;
  instructions?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  applicationUrl?: string | null;
  applicationUrlTitle?: string | null;
};

export function ExternalApplicationActions({
  title,
  instructions,
  email,
  whatsapp,
  applicationUrl,
  applicationUrlTitle,
}: Props) {
  const [copied, setCopied] = useState(false);
  const detectedEmail = useMemo(
    () =>
      email?.trim() ||
      instructions?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ||
      "",
    [email, instructions],
  );
  const rawNumber = (whatsapp || "").replace(/\D/g, "");
  const whatsappNumber =
    rawNumber && rawNumber.length <= 11 ? `55${rawNumber}` : rawNumber;
  const applicationHref = safeApplicationUrl(applicationUrl);
  const copyEmail = async () => {
    if (!detectedEmail) return;
    await navigator.clipboard.writeText(detectedEmail);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="mt-3 space-y-3">
      {instructions && (
        <p className="whitespace-pre-wrap text-sm">{instructions}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {applicationHref && (
          <a
            href={applicationHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-terracotta-600 px-3 py-2 text-xs font-bold text-white hover:bg-terracotta-700"
          >
            <ExternalLink className="h-4 w-4" /> {applicationUrlLabel(applicationUrlTitle)}
          </a>
        )}
        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Olá! Tenho interesse na vaga ${title}.`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
          >
            <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
          </a>
        )}
        {detectedEmail && (
          <>
            <a
              href={`mailto:${detectedEmail}?subject=${encodeURIComponent(`Candidatura — ${title}`)}`}
              className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-xs font-bold text-white"
            >
              <Mail className="h-4 w-4" /> Enviar e-mail
            </a>
            <button
              type="button"
              onClick={copyEmail}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-700"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copiado" : `Copiar ${detectedEmail}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
