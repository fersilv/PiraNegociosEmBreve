import React, { useState, useRef } from 'react';
import { UploadCloud, X, FileText, CheckCircle2, AlertTriangle, Camera, Smartphone, QrCode } from 'lucide-react';

interface FileUploadProps {
  label: string;
  accept: string;
  value: string; // Base64 data URL or external URL
  onChange: (base64: string, fileName?: string) => void;
  maxSizeKB?: number;
  placeholder?: string;
  type?: 'avatar' | 'document' | 'resume';
}

export function FileUpload({
  label,
  accept,
  value,
  onChange,
  maxSizeKB = 10240, // 10MB default for document photos/PDFs
  placeholder = 'Selecione ou arraste seu documento aqui',
  type = 'document'
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isBase64 = value && value.startsWith('data:');
  const fileTypeStr = isBase64 ? value.split(';')[0].split(':')[1] : '';
  const isImage = type === 'avatar' || (fileTypeStr && fileTypeStr.startsWith('image/')) || (value && value.match(/\.(jpg|jpeg|png|webp|gif)/i));

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const compressImageIfNeeded = (file: File, maxDimension = 1600, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      // If not an image (e.g., PDF), read directly as DataURL
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Resize if larger than maxDimension (e.g. 1600px)
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert image to compressed JPEG or PNG
          const isPng = file.type === 'image/png';
          let compressedDataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);

          // If string is still over ~1.5MB base64 (~1.1MB binary), compress further
          if (compressedDataUrl.length > 1800000 && !isPng) {
            compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          }

          resolve(compressedDataUrl);
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const processFile = async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      // Automatic client-side image compression
      const base64Data = await compressImageIfNeeded(file);

      // Estimate compressed size in KB (base64 length * 3/4 / 1024)
      const estimatedSizeKB = Math.round((base64Data.length * 3) / 4 / 1024);

      if (estimatedSizeKB > maxSizeKB) {
        setError(`O arquivo excede o limite máximo de ${maxSizeKB >= 1024 ? (maxSizeKB/1024).toFixed(0) + 'MB' : maxSizeKB + 'KB'}. Por favor, envie um arquivo menor.`);
        setUploading(false);
        return;
      }

      onChange(base64Data, file.name);
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao processar o arquivo. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const pageQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.href)}`;

  return (
    <div className="space-y-2">
      {/* Hidden file input for file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      {/* Hidden file input for smartphone camera capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />

      <div className="flex justify-between items-center">
        <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest">{label}</label>
        <span className="text-[10px] text-stone-400 font-medium font-mono">
          Máx: {maxSizeKB >= 1024 ? `${(maxSizeKB/1024).toFixed(0)}MB` : `${maxSizeKB}KB`}
        </span>
      </div>

      {value ? (
        // Preview State
        <div className="relative rounded-2xl border border-stone-200 bg-stone-50 p-4 transition-all hover:bg-stone-100/60 group">
          <div className="flex items-center gap-4">
            {type === 'avatar' && isImage ? (
              <div className="relative w-16 h-16 rounded-full overflow-hidden border border-stone-200 bg-stone-100 shrink-0">
                <img referrerPolicy="no-referrer" src={value} alt="Preview Avatar" className="w-full h-full object-cover" />
              </div>
            ) : isImage ? (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-stone-200 bg-stone-100 shrink-0">
                <img referrerPolicy="no-referrer" src={value} alt="Preview Imagem" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl border border-stone-200 bg-stone-100 flex items-center justify-center shrink-0 text-stone-500">
                <FileText className="w-8 h-8 text-stone-600" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-stone-800 flex items-center gap-1.5 truncate">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                {type === 'avatar' ? 'Foto de Perfil' : type === 'resume' ? 'Currículo Anexado' : 'Documento Anexado'}
              </p>
              
              <div className="flex items-center gap-2 mt-1">
                {isBase64 ? (
                  <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Carregado</span>
                ) : (
                  <span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded-full font-medium">Link Externo</span>
                )}
                
                {isBase64 && (
                  <span className="text-[10px] font-mono text-stone-400">
                    ~{formatBytes(Math.round((value.length * 3) / 4))}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-2.5">
                <a
                  href={value}
                  download={type === 'resume' ? 'curriculo.pdf' : 'documento.pdf'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-terracotta-600 font-bold hover:underline"
                >
                  Visualizar / Baixar
                </a>
                <span className="text-stone-300 text-xs">|</span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="text-xs text-stone-500 hover:text-red-600 font-bold cursor-pointer"
                >
                  Substituir Arquivo
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={clearFile}
              className="top-3 right-3 text-stone-400 hover:text-red-500 p-1.5 rounded-full hover:bg-stone-200 transition-colors cursor-pointer"
              title="Remover arquivo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        // Upload Control Box with Camera & Mobile QR Options
        <div className="space-y-2">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-4 text-center transition-all flex flex-col items-center justify-center ${
              dragActive
                ? 'border-terracotta-500 bg-terracotta-50/50 scale-[1.01]'
                : 'border-stone-200 hover:border-terracotta-400 hover:bg-stone-50/50 bg-white'
            }`}
          >
            <div className="p-2.5 bg-stone-100 rounded-full text-stone-500 mb-2">
              <UploadCloud className="w-5 h-5 text-terracotta-600" />
            </div>

            <p className="text-xs font-bold text-stone-800 mb-1">
              {uploading ? 'Carregando arquivo...' : placeholder}
            </p>

            {/* Action Buttons: Camera (Mobile only) vs File Picker */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2 w-full">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex md:hidden items-center gap-1.5 cursor-pointer shadow-xs transition-all"
              >
                <Camera className="w-3.5 h-3.5 text-amber-300" />
                Tirar Foto (Câmera)
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-stone-500" />
                Escolher Arquivo / Foto / PDF
              </button>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-1.5 text-red-600 text-[11px] bg-red-50 p-2.5 rounded-xl border border-red-100 font-medium w-full text-left">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR CODE HANDOFF MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative border border-stone-200">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1 rounded-full hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-terracotta-100 rounded-full flex items-center justify-center mx-auto text-terracotta-600">
              <QrCode className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-stone-900">Fotografar pelo Celular</h3>
              <p className="text-xs text-stone-500 mt-1">
                Escaneie o QR Code abaixo com a câmera do seu smartphone para abrir esta mesma página no celular e tirar fotos dos seus documentos diretamente da câmera.
              </p>
            </div>

            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 inline-block">
              <img 
                referrerPolicy="no-referrer"
                src={pageQrUrl} 
                alt="QR Code para abrir no celular"
                className="w-48 h-48 mx-auto rounded-lg"
              />
            </div>

            <div className="text-[11px] text-stone-400 bg-stone-50 p-2.5 rounded-xl border border-stone-100 text-left space-y-1">
              <p className="font-bold text-stone-600 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5" /> Dica para fotodocumentos:
              </p>
              <p>• Mantenha o documento bem iluminado e sem reflexos.</p>
              <p>• Certifique-se que o texto esteja perfeitamente legível.</p>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full bg-stone-900 text-white font-bold text-xs py-3 rounded-xl hover:bg-stone-800 transition-colors"
            >
              Concluído
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
