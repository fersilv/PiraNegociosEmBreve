import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { openBase64InNewTab } from '../lib/fileViewer';
import { PublishedResumeViewerModal } from './PublishedResumeViewerModal';

function realFileUrl(value?: string) {
  return Boolean(value && (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('blob:')));
}

export function PublishedResumeCompanyBridge() {
  const location = useLocation();
  const [candidate, setCandidate] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const companyContext = location.pathname.startsWith('/company/') || location.pathname.startsWith('/dashboard/');

  useEffect(() => {
    if (!companyContext) return;

    const handleLegacyPdfShortcut = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button || (button.textContent || '').trim() !== 'PDF') return;
      const row = button.closest('tr');
      if (!row) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const rowText = row.textContent || '';
      void api.get('/candidates')
        .then((response) => {
          const items = Array.isArray(response.data) ? response.data : [];
          const matched = items.find((item: any) => item?.email && rowText.includes(String(item.email)))
            || items.find((item: any) => item?.name && rowText.includes(String(item.name)));
          if (!matched) {
            alert('Não foi possível localizar a versão publicada deste currículo.');
            return;
          }
          if (matched.publishedResumeSnapshot) {
            setCandidate(matched);
            setOpen(true);
            return;
          }
          if (realFileUrl(matched.resumeURL)) {
            openBase64InNewTab(matched.resumeURL, `Currículo_${matched.name || 'candidato'}`);
            return;
          }
          alert('Este candidato ainda não possui uma versão publicada do currículo disponível.');
        })
        .catch(() => alert('Não foi possível abrir o currículo agora.'));
    };

    document.addEventListener('click', handleLegacyPdfShortcut, true);
    return () => document.removeEventListener('click', handleLegacyPdfShortcut, true);
  }, [companyContext]);

  return (
    <PublishedResumeViewerModal
      snapshot={candidate?.publishedResumeSnapshot}
      fallbackName={candidate?.name}
      isOpen={open}
      onClose={() => {
        setOpen(false);
        setCandidate(null);
      }}
    />
  );
}
