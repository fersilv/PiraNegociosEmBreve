import React, { useMemo, useRef } from 'react';
import { FileDown, X } from 'lucide-react';
import type { UserProfile } from '../contexts/AuthContext';
import { ClassicTemplate } from './resume-templates/ClassicTemplate';
import { CreativeTemplate } from './resume-templates/CreativeTemplate';
import { MinimalistTemplate } from './resume-templates/MinimalistTemplate';
import { ModernTemplate } from './resume-templates/ModernTemplate';

export interface PublishedResumeSnapshotLike {
  version?: number;
  publishedAt?: string;
  fullName?: string;
  socialName?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  address?: string;
  bio?: string;
  experiences?: any[];
  education?: any[];
  skills?: string[];
  courses?: any[];
  languages?: any[];
  salaryExpectation?: string;
  jobPreferences?: Record<string, unknown>;
  resumePhotoURL?: string;
  resumePreferences?: {
    nameMode?: 'SOCIAL' | 'CIVIL';
    showHeadline?: boolean;
    headline?: string;
    showPhoto?: boolean;
    template?: 'modern' | 'creative' | 'classic' | 'minimalist';
    color?: string;
  };
  score?: number | null;
}

interface PublishedResumeViewerModalProps {
  snapshot: PublishedResumeSnapshotLike | null | undefined;
  fallbackName?: string;
  isOpen: boolean;
  onClose: () => void;
}

function profileFromSnapshot(snapshot: PublishedResumeSnapshotLike, fallbackName?: string): UserProfile {
  return {
    treatment: '',
    phone: snapshot.phone || '',
    email: snapshot.email || '',
    type: 'CANDIDATE',
    fullName: snapshot.fullName || fallbackName || 'Candidato',
    displayName: snapshot.fullName || fallbackName || 'Candidato',
    socialName: snapshot.socialName || '',
    bio: snapshot.bio || '',
    experiences: Array.isArray(snapshot.experiences) ? snapshot.experiences : [],
    education: Array.isArray(snapshot.education) ? snapshot.education : [],
    skills: Array.isArray(snapshot.skills) ? snapshot.skills : [],
    courses: Array.isArray(snapshot.courses) ? snapshot.courses : [],
    languages: Array.isArray(snapshot.languages) ? snapshot.languages : [],
    salaryExpectation: snapshot.salaryExpectation || '',
    city: snapshot.city || '',
    state: snapshot.state || '',
    address: snapshot.address || [snapshot.city, snapshot.state].filter(Boolean).join(' - '),
    jobPreferences: (snapshot.jobPreferences || {}) as any,
    resumePhotoURL: snapshot.resumePhotoURL || '',
    resumePreferences: {
      nameMode: snapshot.resumePreferences?.nameMode || 'SOCIAL',
      showHeadline: snapshot.resumePreferences?.showHeadline !== false,
      headline: snapshot.resumePreferences?.headline || '',
      showPhoto: snapshot.resumePreferences?.showPhoto !== false,
      template: snapshot.resumePreferences?.template || 'modern',
      color: snapshot.resumePreferences?.color || '#0284c7',
    },
  };
}

function collectHeadStyles() {
  return Array.from(document.head.querySelectorAll<HTMLElement>('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n');
}

async function waitForAssets(target: Window) {
  const images = Array.from(target.document.images);
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
      window.setTimeout(resolve, 2000);
    });
  }));
  try {
    await target.document.fonts?.ready;
  } catch {
    // O navegador ainda pode imprimir com a fonte de fallback.
  }
}

async function printPublishedResume(root: HTMLElement | null) {
  const source = root?.querySelector<HTMLElement>('.resume-a4-document');
  if (!source) return;
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('style').forEach((style) => style.remove());
  clone.classList.add('published-resume-print-document');

  const target = window.open('', '_blank', 'width=960,height=760');
  if (!target) return;
  const styles = collectHeadStyles();
  target.document.open();
  target.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Currículo publicado</title>${styles}<style>
    @page { size: A4 portrait; margin: 0 0 12mm; }
    html, body { margin:0 !important; padding:0 !important; width:210mm !important; min-width:210mm !important; background:#fff !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    body { overflow:visible !important; }
    .published-resume-print-shell, .published-resume-print-document { width:210mm !important; min-width:210mm !important; max-width:210mm !important; margin:0 !important; border:0 !important; box-shadow:none !important; overflow:visible !important; background:#fff !important; }
    .published-resume-print-document { min-height:0 !important; height:auto !important; }
    .published-resume-print-document::after { display:none !important; }
    .published-resume-print-document section, .published-resume-print-document article { break-inside:auto !important; page-break-inside:auto !important; }
    .published-resume-print-document .break-inside-avoid, .published-resume-print-document li, .published-resume-print-document img { break-inside:avoid-page !important; page-break-inside:avoid !important; }
    @media screen { body { background:#e7e5e4 !important; } .published-resume-print-shell { margin:20px auto !important; box-shadow:0 20px 60px rgba(28,25,23,.18) !important; } }
  </style></head><body></body></html>`);
  target.document.close();
  const shell = target.document.createElement('div');
  shell.className = 'published-resume-print-shell';
  shell.appendChild(target.document.importNode(clone, true));
  target.document.body.appendChild(shell);
  await waitForAssets(target);
  window.setTimeout(() => {
    target.focus();
    target.print();
  }, 160);
}

export function PublishedResumeViewerModal({ snapshot, fallbackName, isOpen, onClose }: PublishedResumeViewerModalProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const profile = useMemo(() => snapshot ? profileFromSnapshot(snapshot, fallbackName) : null, [fallbackName, snapshot]);
  if (!isOpen || !snapshot || !profile) return null;

  const preferences = profile.resumePreferences || {};
  const template = preferences.template || 'modern';
  const color = preferences.color || '#0284c7';
  const showPhoto = preferences.showPhoto !== false;
  const address = profile.address || [profile.city, profile.state].filter(Boolean).join(' - ');
  const commonProps = { profile, color, showPhoto, address, isFirstJob: !profile.experiences?.length };

  const rendered = template === 'creative'
    ? <CreativeTemplate {...commonProps} />
    : template === 'classic'
      ? <ClassicTemplate {...commonProps} />
      : template === 'minimalist'
        ? <MinimalistTemplate {...commonProps} />
        : <ModernTemplate {...commonProps} />;

  return (
    <div className="fixed inset-0 z-[180] flex flex-col bg-stone-950/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Currículo publicado">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-stone-950/90 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-terracotta-300">Versão publicada pelo candidato</p>
          <h2 className="truncate text-sm font-black">{profile.socialName || profile.fullName || fallbackName || 'Currículo'}</h2>
          <p className="mt-0.5 text-[10px] text-white/45">Modelo {template} · versão {snapshot.version || 1}{snapshot.publishedAt ? ` · publicada em ${new Date(snapshot.publishedAt).toLocaleDateString('pt-BR')}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void printPublishedResume(previewRef.current)} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-stone-900 hover:bg-stone-100">
            <FileDown className="h-4 w-4" /> Imprimir / salvar PDF
          </button>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15" aria-label="Fechar currículo">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div ref={previewRef} className="flex-1 overflow-auto bg-stone-200 p-4 sm:p-7">
        <div className="mx-auto w-[210mm] max-w-none shadow-2xl">
          {rendered}
        </div>
      </div>
    </div>
  );
}
