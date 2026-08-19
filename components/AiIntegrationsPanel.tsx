import React, { useState, useEffect } from 'react';
import { Save, Key, Cpu, Loader2, Sparkles } from 'lucide-react';
import { api } from '../lib/api';

interface AiModelInfo {
  id: string;
  name: string;
  provider: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
}

export function AiIntegrationsPanel() {
  const [keys, setKeys] = useState({
    GEMINI_API_KEY: '',
    OPENAI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModels, setShowModels] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/admin/settings');
      setKeys({
        GEMINI_API_KEY: response.data.GEMINI_API_KEY || '',
        OPENAI_API_KEY: response.data.OPENAI_API_KEY || '',
        ANTHROPIC_API_KEY: response.data.ANTHROPIC_API_KEY || '',
      });
    } catch (error) {
      console.error('Erro ao carregar configs', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await Promise.all(
        Object.entries(keys).map(([key, value]) =>
          api.post('/admin/settings', { key, value, description: `Chave para ${key}` })
        )
      );
      setMessage({ type: 'success', text: 'Chaves salvas com sucesso!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar chaves.' });
    } finally {
      setSaving(false);
    }
  };

  const handleFetchModels = async () => {
    setLoadingModels(true);
    try {
      const response = await api.get('/admin/ai/models');
      setModels(response.data);
      setShowModels(true);
    } catch (error) {
      alert('Erro ao buscar modelos disponíveis. Verifique as chaves.');
    } finally {
      setLoadingModels(false);
    }
  };

  if (loading) return <div className="p-4"><Loader2 className="animate-spin w-5 h-5 text-stone-500" /></div>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">
          Automação e IA
        </p>
        <h1 className="mt-1 text-3xl font-serif font-bold text-stone-900">
          Integrações de Inteligência Artificial
        </h1>
        <p className="mt-1 text-stone-500">
          Configure as chaves de API dos provedores de IA para habilitar a análise automática de currículos e o Career Matching.
        </p>
      </header>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
            <Key className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-stone-900">Chaves de API</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-1">Google Gemini API Key</label>
              <input
                type="password"
                className="w-full rounded-xl border-stone-300 shadow-sm focus:border-terracotta-500 focus:ring-terracotta-500"
                value={keys.GEMINI_API_KEY}
                onChange={(e) => setKeys({ ...keys, GEMINI_API_KEY: e.target.value })}
                placeholder="AIzaSy..."
              />
              <p className="text-xs text-stone-500 mt-1">Usada atualmente para análise de currículos e match de vagas.</p>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-1">OpenAI API Key</label>
              <input
                type="password"
                className="w-full rounded-xl border-stone-300 shadow-sm focus:border-terracotta-500 focus:ring-terracotta-500"
                value={keys.OPENAI_API_KEY}
                onChange={(e) => setKeys({ ...keys, OPENAI_API_KEY: e.target.value })}
                placeholder="sk-proj-..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-1">Anthropic API Key</label>
              <input
                type="password"
                className="w-full rounded-xl border-stone-300 shadow-sm focus:border-terracotta-500 focus:ring-terracotta-500"
                value={keys.ANTHROPIC_API_KEY}
                onChange={(e) => setKeys({ ...keys, ANTHROPIC_API_KEY: e.target.value })}
                placeholder="sk-ant-..."
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta-600 px-4 py-3 font-bold text-white transition-colors hover:bg-terracotta-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Chaves
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
            <Cpu className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-stone-900">Gerenciamento de Modelos</h3>
          </div>
          <p className="text-sm text-stone-600">
            Verifique quais modelos estão disponíveis com as chaves configuradas e compare os custos estimados para processamento de linguagem natural.
          </p>
          <button
            onClick={handleFetchModels}
            disabled={loadingModels}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-stone-200 bg-white px-4 py-3 font-bold text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            {loadingModels ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Testar Chaves e Ver Modelos
          </button>
        </section>
      </div>

      {showModels && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden flex flex-col rounded-2xl bg-white shadow-xl">
            <div className="border-b border-stone-200 px-6 py-4 flex justify-between items-center bg-stone-50">
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-600" />
                Modelos Disponíveis ({models.length})
              </h2>
              <button onClick={() => setShowModels(false)} className="text-stone-400 hover:text-stone-600 font-bold">FECHAR</button>
            </div>
            
            <div className="overflow-auto p-6">
              {models.length === 0 ? (
                <div className="text-center text-stone-500 py-10">
                  Nenhum modelo encontrado. Verifique se as chaves de API estão corretas e salvas.
                </div>
              ) : (
                <table className="w-full text-left text-sm text-stone-600">
                  <thead className="bg-stone-100 text-stone-900">
                    <tr>
                      <th className="rounded-l-lg p-3 font-bold">Provedor</th>
                      <th className="p-3 font-bold">Modelo (ID)</th>
                      <th className="p-3 font-bold">Preço de Entrada (1M)</th>
                      <th className="rounded-r-lg p-3 font-bold">Preço de Saída (1M)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((m, i) => (
                      <tr key={i} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
                        <td className="p-3 font-medium text-stone-900">{m.provider}</td>
                        <td className="p-3 font-mono text-xs">{m.id}</td>
                        <td className="p-3">{m.inputCostPer1M > 0 ? `$${m.inputCostPer1M.toFixed(3)}` : 'Desconhecido'}</td>
                        <td className="p-3">{m.outputCostPer1M > 0 ? `$${m.outputCostPer1M.toFixed(3)}` : 'Desconhecido'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-4 text-xs text-stone-400">
                * Os preços são estimativas baseadas na tabela padrão de custos. Consulte o painel oficial da API para valores exatos de faturamento.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
