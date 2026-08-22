import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  QrCode,
  Sparkles,
  Smartphone,
  UploadCloud,
  X,
} from 'lucide-react';
import { useImageAiStatus } from '../hooks/useImageAiStatus';
import { api } from '../lib/api';

interface FileUploadProps {
  label: string;
  accept: string;
  value: string;
  onChange: (base64: string, fileName?: string) => void;
  maxSizeKB?: number;
  placeholder?: string;
  type?: 'avatar' | 'document' | 'resume';
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(blob);
  });
}

export function FileUpload({
  label,
  accept,
  value,
  onChange,
  maxSizeKB,
  placeholder = 'Selecione ou arraste seu documento aqui',
  type = 'document',
}: FileUploadProps) {
  const { enabled: imageAiEnabled } = useImageAiStatus();
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [enhancingPhoto, setEnhancingPhoto] = useState(false);
  const [aiPhoto, setAiPhoto] = useState('');
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonOriginal, setComparisonOriginal] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const effectiveMaxSizeKB = maxSizeKB ?? (type === 'avatar' ? 20480 : 10240);

  const isBase64 = Boolean(value && value.startsWith('data:'));
  const fileTypeStr = isBase64 ? value.split(';')[0].split(':')[1] : '';
  const isImage =
    type === 'avatar' ||
    Boolean(fileTypeStr && fileTypeStr.startsWith('image/')) ||
    Boolean(value && value.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i));

  // Company logos also use the avatar renderer. Photo AI must never be offered there.
  // The action is additionally controlled by the dedicated image-AI switch in admin.
  const isPersonPhoto = type === 'avatar' && !/logo|logotipo/i.test(label);
  const canEnhanceWithAi = isPersonPhoto && imageAiEnabled && Boolean(value);

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') setDragActive(true);
    if (event.type === 'dragleave') setDragActive(false);
  };

  const compressImageIfNeeded = (
    file: File,
    maxDimension = 1600,
    quality = 0.82,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const source = String(reader.result || '');
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) return resolve(source);
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(img, 0, 0, width, height);
          const png = file.type === 'image/png';
          let result = canvas.toDataURL(png ? 'image/png' : 'image/jpeg', quality);
          if (result.length > 1_800_000 && !png) result = canvas.toDataURL('image/jpeg', 0.65);
          resolve(result);
        };
        img.onerror = () => resolve(source);
        img.src = source;
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const processFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      if (file.size > effectiveMaxSizeKB * 1024) {
        setError(
          `O arquivo excede o limite máximo de ${
            effectiveMaxSizeKB >= 1024
              ? `${(effectiveMaxSizeKB / 1024).toFixed(0)}MB`
              : `${effectiveMaxSizeKB}KB`
          }.`,
        );
        return;
      }
      const base64Data = await compressImageIfNeeded(file);
      const estimatedSizeKB = Math.round((base64Data.length * 3) / 4 / 1024);
      if (estimatedSizeKB > effectiveMaxSizeKB) {
        setError('O arquivo processado ainda ficou grande demais. Escolha uma imagem menor.');
        return;
      }
      // Upload always keeps the real photo first. AI is an explicit second action.
      onChange(base64Data, file.name);
      setAiPhoto('');
      setComparisonOpen(false);
    } catch (uploadError) {
      console.error(uploadError);
      setError('Ocorreu um erro ao processar o arquivo. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const imageForAi = async (current: string) => {
    if (current.startsWith('data:image/')) return current;
    try {
      const response = await fetch(current, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('URL não é uma imagem.');
      return await readBlobAsDataUrl(blob);
    } catch (conversionError) {
      console.warn('Não foi possível converter a foto externa:', conversionError);
      throw new Error(
        'Essa foto veio de um serviço externo e não pôde ser enviada à IA. Substitua-a por uma foto do seu dispositivo e tente novamente.',
      );
    }
  };

  const requestProfessionalPhoto = async () => {
    if (!value || enhancingPhoto) return;
    setError(null);
    setEnhancingPhoto(true);
    try {
      const original = await imageForAi(value);
      const response = await api.post(
        '/ai/professionalize-photo',
        { image: original },
        { timeout: 180000 },
      );
      const generated = String(response.data?.image || '');
      if (!generated.startsWith('data:image/')) {
        throw new Error('A IA não devolveu uma imagem válida.');
      }
      setComparisonOriginal(value);
      setAiPhoto(generated);
      setComparisonOpen(true);
    } catch (enhanceError: any) {
      console.error(enhanceError);
      setError(
        enhanceError?.response?.data?.message ||
          enhanceError?.message ||
          'Não foi possível criar a versão profissional da foto agora.',
      );
    } finally {
      setEnhancingPhoto(false);
    }
  };

  const useAiPhoto = () => {
    if (!aiPhoto) return;
    onChange(aiPhoto, 'foto-profissional-ia.png');
    setComparisonOpen(false);
    setComparisonOriginal('');
    setAiPhoto('');
  };

  const clearFile = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onChange('');
    setError(null);
    setAiPhoto('');
    setComparisonOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void processFile(file);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const units = ['Bytes', 'KB', 'MB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
  };

  const pageQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    window.location.href,
  )}`;

  return (
    <div className="space-y-2">
      <input ref={fileInputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture={type === 'avatar' ? 'user' : 'environment'}
        onChange={handleChange}
        className="hidden"
      />

      <div className="flex items-center justify-between gap-3">
        <label className="block text-xs font-bold uppercase tracking-widest text-stone-500">{label}</label>
        <span className="font-mono text-[10px] font-medium text-stone-400">
          Máx: {effectiveMaxSizeKB >= 1024 ? `${(effectiveMaxSizeKB / 1024).toFixed(0)}MB` : `${effectiveMaxSizeKB}KB`}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium leading-5 text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {value ? (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center gap-4">
            {isImage ? (
              <div
                className={`${type === 'avatar' ? 'rounded-full' : 'rounded-xl'} relative h-16 w-16 shrink-0 overflow-hidden border border-stone-200 bg-stone-100`}
              >
                <img referrerPolicy="no-referrer" src={value} alt="Prévia" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-stone-100 text-stone-500">
                <FileText className="h-8 w-8" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-bold text-stone-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                {type === 'avatar' ? 'Imagem carregada' : type === 'resume' ? 'Currículo anexado' : 'Documento anexado'}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isBase64 ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-stone-700'}`}>
                  {isBase64 ? 'Carregado' : 'Link externo'}
                </span>
                {isBase64 && (
                  <span className="font-mono text-[10px] text-stone-400">~{formatBytes(Math.round((value.length * 3) / 4))}</span>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <a href={value} target="_blank" rel="noreferrer" className="text-xs font-bold text-terracotta-600 hover:underline">
                  Visualizar
                </a>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-stone-500 hover:text-stone-800">
                  Substituir
                </button>
                {canEnhanceWithAi && (
                  <button
                    type="button"
                    onClick={() => void requestProfessionalPhoto()}
                    disabled={enhancingPhoto}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-100 px-2.5 py-1.5 text-xs font-black text-violet-800 transition hover:bg-violet-200 disabled:opacity-50"
                  >
                    {enhancingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {enhancingPhoto ? 'Criando versão...' : 'Aprimorar com IA'}
                  </button>
                )}
              </div>
            </div>

            <button type="button" onClick={clearFile} className="rounded-full p-1.5 text-stone-400 transition hover:bg-stone-200 hover:text-red-500" title="Remover arquivo">
              <X className="h-4 w-4" />
            </button>
          </div>
          {canEnhanceWithAi && !enhancingPhoto && (
            <p className="mt-3 border-t border-stone-200 pt-3 text-[11px] leading-5 text-stone-500">
              A IA cria uma nova foto profissional preservando sua identidade. Sua foto atual só é trocada depois que você comparar e escolher.
            </p>
          )}
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
            dragActive ? 'scale-[1.01] border-terracotta-500 bg-terracotta-50/50' : 'border-stone-200 bg-white hover:border-terracotta-400 hover:bg-stone-50/50'
          }`}
        >
          <div className="mb-2 rounded-full bg-stone-100 p-2.5 text-stone-500">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin text-terracotta-600" /> : <UploadCloud className="h-5 w-5 text-terracotta-600" />}
          </div>
          <p className="mb-1 text-xs font-bold text-stone-800">{uploading ? 'Carregando arquivo...' : placeholder}</p>
          <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-2">
            {type === 'avatar' && (
              <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-bold text-white md:hidden">
                <Camera className="h-4 w-4" /> Câmera
              </button>
            )}
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 rounded-xl bg-terracotta-600 px-3.5 py-2 text-xs font-bold text-white">
              <UploadCloud className="h-4 w-4" /> Selecionar arquivo
            </button>
            <button type="button" onClick={() => setShowQrModal(true)} className="hidden items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-600 md:flex">
              <Smartphone className="h-4 w-4" /> Usar celular
            </button>
          </div>
        </div>
      )}

      {comparisonOpen && aiPhoto && comparisonOriginal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm" onClick={() => setComparisonOpen(false)}>
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-[#fffdfa] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Aprimoramento por IA</p>
                <h3 className="mt-1 font-serif text-2xl font-bold text-stone-950">Qual foto você prefere?</h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">Nada muda até você escolher uma das versões.</p>
              </div>
              <button type="button" onClick={() => setComparisonOpen(false)} className="rounded-full bg-stone-100 p-2 text-stone-500 hover:bg-stone-200" aria-label="Fechar comparação">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <PhotoChoice title="Foto atual" subtitle="A imagem que você já estava usando" src={comparisonOriginal} />
              <PhotoChoice title="Versão profissional" subtitle="Criada pela IA a partir da sua foto" src={aiPhoto} ai />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-stone-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" onClick={() => setComparisonOpen(false)} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-600">
                Manter foto atual
              </button>
              <button type="button" onClick={useAiPhoto} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-black text-white hover:bg-violet-800">
                <Sparkles className="h-4 w-4" /> Usar versão da IA
              </button>
            </div>
          </div>
        </div>
      )}

      {showQrModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setShowQrModal(false)}>
          <div className="w-full max-w-sm rounded-[26px] bg-white p-6 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setShowQrModal(false)} className="ml-auto flex rounded-full bg-stone-100 p-2 text-stone-500">
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta-50 text-terracotta-600">
              <QrCode className="h-6 w-6" />
            </div>
            <h3 className="font-serif text-xl font-bold text-stone-900">Abra esta página no celular</h3>
            <p className="mt-2 text-xs leading-5 text-stone-500">Escaneie o QR Code e use a câmera ou a galeria do telefone.</p>
            <img src={pageQrUrl} alt="QR Code" className="mx-auto mt-5 h-[210px] w-[210px] rounded-xl border border-stone-200 bg-white p-2" />
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoChoice({ title, subtitle, src, ai = false }: { title: string; subtitle: string; src: string; ai?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-2xl border ${ai ? 'border-violet-200 bg-violet-50/40' : 'border-stone-200 bg-white'}`}>
      <div className="aspect-square bg-stone-100">
        <img src={src} alt={title} className="h-full w-full object-cover" />
      </div>
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <strong className="text-sm text-stone-900">{title}</strong>
          {ai && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-700">IA</span>}
        </div>
        <p className="mt-1 text-xs leading-5 text-stone-500">{subtitle}</p>
      </div>
    </div>
  );
}
