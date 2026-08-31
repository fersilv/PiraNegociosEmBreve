import React from 'react';

const CHUNK_ERROR_PATTERN = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|module script|MIME type/i;
const RETRY_KEY = 'pn:chunk-recovery:last-reload';
const RETRY_WINDOW_MS = 60_000;

type State = {
  error: Error | null;
};

export class ChunkRecoveryBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (!isChunkLoadError(error)) return;
    const lastReload = Number(sessionStorage.getItem(RETRY_KEY) || 0);
    if (!Number.isFinite(lastReload) || Date.now() - lastReload > RETRY_WINDOW_MS) {
      sessionStorage.setItem(RETRY_KEY, String(Date.now()));
      window.location.reload();
    }
  }

  private reload = () => {
    sessionStorage.removeItem(RETRY_KEY);
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const chunkError = isChunkLoadError(this.state.error);
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 py-12 text-stone-900">
        <section className="w-full max-w-lg rounded-3xl bg-white p-7 text-center shadow-xl ring-1 ring-stone-200">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">PiraNegócios</p>
          <h1 className="mt-3 font-serif text-3xl font-black">
            {chunkError ? 'Uma versão nova acabou de entrar no ar' : 'Não foi possível abrir esta área'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-500">
            {chunkError
              ? 'Seu navegador tentou usar um arquivo da versão anterior. Atualize para carregar os arquivos novos.'
              : 'A página encontrou um erro inesperado. Recarregue e tente novamente.'}
          </p>
          <button type="button" onClick={this.reload} className="mt-6 rounded-2xl bg-stone-950 px-5 py-3 text-xs font-black text-white">
            Atualizar agora
          </button>
        </section>
      </main>
    );
  }
}

function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error || '');
  return CHUNK_ERROR_PATTERN.test(message);
}
