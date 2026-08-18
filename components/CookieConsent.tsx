import { useEffect, useState } from 'react';
import { Cookie, Settings2, ShieldCheck, X } from 'lucide-react';
import { getPrivacyConsent, savePrivacyConsent } from '../lib/privacyConsent';

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    const saved = getPrivacyConsent();
    if (!saved) setOpen(true);
    else {
      setAnalytics(saved.analytics);
      setAdvertising(saved.advertising);
    }
  }, []);

  const save = (nextAnalytics: boolean, nextAdvertising: boolean) => {
    savePrivacyConsent({ analytics: nextAnalytics, advertising: nextAdvertising });
    setAnalytics(nextAnalytics);
    setAdvertising(nextAdvertising);
    setOpen(false);
    setCustomizing(false);
  };

  if (!open) {
    return null;
  }

  return <section className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:bottom-5 sm:p-6" aria-label="Preferências de privacidade" role="dialog" aria-modal="true">
    <div className="flex items-start gap-4">
      <div className="rounded-xl bg-terracotta-50 p-3 text-terracotta-700"><Cookie className="h-6 w-6" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-serif text-xl font-bold text-stone-900">Sua privacidade, suas escolhas</h2><p className="mt-1 text-sm leading-relaxed text-stone-600">Usamos recursos essenciais para manter sua sessão segura. Métricas de navegação e publicidade só são ativadas com a sua permissão.</p></div><button type="button" onClick={() => save(false, false)} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100" aria-label="Recusar itens opcionais"><X className="h-5 w-5" /></button></div>
        {customizing && <div className="mt-4 space-y-3 rounded-xl bg-stone-50 p-4 text-sm"><Preference title="Essenciais e segurança" description="Autenticação, prevenção de fraude e funcionamento do portal." checked disabled onChange={() => undefined} /><Preference title="Métricas de uso" description="Visitas, origem, páginas e tempo de navegação em dados agregados." checked={analytics} onChange={setAnalytics} /><Preference title="Publicidade personalizada" description="Anúncios continuam aparecendo sem esta opção, porém de forma contextual e sem personalização baseada no seu comportamento." checked={advertising} onChange={setAdvertising} /></div>}
        <p className="mt-4 flex items-center gap-2 text-xs text-stone-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Você pode mudar essa decisão a qualquer momento pelo ícone de preferências.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => save(false, false)} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-50">Somente essenciais</button><button type="button" onClick={() => setCustomizing(value => !value)} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-50">{customizing ? 'Fechar opções' : 'Personalizar'}</button><button type="button" onClick={() => save(true, true)} className="rounded-xl bg-terracotta-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-terracotta-700">Aceitar tudo</button>{customizing && <button type="button" onClick={() => save(analytics, advertising)} className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-stone-800">Salvar escolhas</button>}</div>
      </div>
    </div>
  </section>;
}

function Preference({ title, description, checked, disabled = false, onChange }: { title: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4"><span><strong className="text-stone-800">{title}</strong><span className="mt-0.5 block text-xs text-stone-500">{description}</span></span><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500 disabled:opacity-60" /></label>;
}
