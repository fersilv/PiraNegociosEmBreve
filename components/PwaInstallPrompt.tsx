import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPrompt);
    };
    const onInstalled = () => setDeferredPrompt(null);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const install = async () => {
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <aside className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-terracotta-200 bg-white p-4 shadow-xl" aria-label="Instalar aplicativo">
      <div className="flex-1">
        <p className="font-bold text-stone-900">Instale o PiraNegócios</p>
        <p className="text-xs text-stone-500">Acesso rápido pela tela inicial, como um aplicativo.</p>
      </div>
      <button onClick={install} className="inline-flex items-center gap-1.5 rounded-xl bg-terracotta-600 px-3 py-2 text-xs font-bold text-white hover:bg-terracotta-700"><Download className="h-4 w-4" /> Instalar</button>
      <button onClick={() => setDismissed(true)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100" aria-label="Fechar"><X className="h-4 w-4" /></button>
    </aside>
  );
}
