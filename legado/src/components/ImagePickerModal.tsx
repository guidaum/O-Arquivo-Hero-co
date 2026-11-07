import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Image as ImageIcon, 
  Upload, 
  Link as LinkIcon, 
  X, 
  Trash2, 
  AlertCircle, 
  Loader2, 
  Check,
  Camera,
  FlipHorizontal,
  RefreshCw,
  VideoOff
} from 'lucide-react';
import { cn } from '../lib/utils';

// Helper to safely process and compress uploaded images for local preview & storage
export const processImageFile = (file: File, maxDim = 1280): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo selecionado não é uma imagem válida.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Erro ao carregar a imagem.'));
      img.src = result;
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
};

export interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (url: string) => void;
  title?: string;
  subtitle?: string;
  confirmText?: string;
  initialUrl?: string;
  initialTab?: 'url' | 'upload' | 'camera';
  maxDimension?: number;
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Adicionar Imagem",
  subtitle = "Insira uma URL, faça upload ou tire uma foto",
  confirmText = "Confirmar Imagem",
  initialUrl = "",
  initialTab = 'url',
  maxDimension = 1280
}) => {
  const [activeTab, setActiveTab] = React.useState<'url' | 'upload' | 'camera'>(initialTab);
  const [urlInput, setUrlInput] = React.useState(initialUrl);
  const [previewUrl, setPreviewUrl] = React.useState(initialUrl);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Camera state
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = React.useState<'user' | 'environment'>('user');
  const [cameraLoading, setCameraLoading] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = React.useState(false);

  const stopCamera = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = React.useCallback(async (facing: 'user' | 'environment' = facingMode) => {
    stopCamera();
    setCameraError(null);
    setCameraLoading(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Acesso à câmera não suportado neste navegador/dispositivo.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1080 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera access unavailable:', err?.message || err);
      let msg = 'Não foi possível acessar a câmera do dispositivo.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err?.message?.toLowerCase().includes('denied') || err?.message?.toLowerCase().includes('permission')) {
        msg = 'Permissão para usar a câmera foi negada. Permita o acesso à câmera nas configurações do navegador ou utilize o upload de imagem.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Nenhuma câmera encontrada neste dispositivo.';
      }
      setCameraError(msg);
    } finally {
      setCameraLoading(false);
    }
  }, [facingMode, stopCamera]);

  React.useEffect(() => {
    if (isOpen) {
      setUrlInput(initialUrl || '');
      setPreviewUrl(initialUrl || '');
      setError(null);
      setCameraError(null);
      setIsProcessing(false);
      setActiveTab(initialTab);
    } else {
      stopCamera();
    }
  }, [isOpen, initialUrl, initialTab, stopCamera]);

  // Handle camera start/stop when activeTab changes
  React.useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, startCamera, stopCamera, facingMode]);

  const toggleFacingMode = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 200);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 640;

    // Crop to square for character portrait
    const minDim = Math.min(width, height);
    const startX = (width - minDim) / 2;
    const startY = (height - minDim) / 2;

    const targetDim = Math.min(minDim, maxDimension);
    canvas.width = targetDim;
    canvas.height = targetDim;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If front camera, flip horizontally for natural mirror feel
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      video,
      startX, startY, minDim, minDim,
      0, 0, canvas.width, canvas.height
    );

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setPreviewUrl(dataUrl);
    setUrlInput('');
    stopCamera();
  };

  if (!isOpen) return null;

  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    setError(null);
    setPreviewUrl(value.trim());
  };

  const handleFile = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    try {
      const processed = await processImageFile(file, maxDimension);
      setPreviewUrl(processed);
      setUrlInput('');
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar arquivo de imagem.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleConfirm = () => {
    if (!previewUrl) return;
    onConfirm(previewUrl);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-obsidian/85 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg glass-modal bg-obsidian/90 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-arcane/15 text-arcane border border-arcane/25">
                <ImageIcon size={20} />
              </div>
              <div>
                <h3 className="text-xl font-serif text-parchment">{title}</h3>
                <p className="text-xs font-mono text-parchment/40 uppercase tracking-widest">
                  {subtitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40 hover:text-parchment cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab switcher */}
          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeTab === 'url' 
                  ? "bg-arcane text-obsidian font-bold shadow-md" 
                  : "text-parchment/60 hover:text-parchment"
              )}
            >
              <LinkIcon size={14} /> URL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeTab === 'upload' 
                  ? "bg-arcane text-obsidian font-bold shadow-md" 
                  : "text-parchment/60 hover:text-parchment"
              )}
            >
              <Upload size={14} /> Upload
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeTab === 'camera' 
                  ? "bg-arcane text-obsidian font-bold shadow-md" 
                  : "text-parchment/60 hover:text-parchment"
              )}
            >
              <Camera size={14} /> Câmera
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'url' ? (
            <div className="space-y-3">
              <label className="text-xs font-mono uppercase tracking-widest text-parchment/60 flex items-center gap-2">
                <LinkIcon size={13} className="text-arcane" />
                Insira a URL da imagem
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="insira a URL da imagem"
                  className="w-full bg-white/5 border border-white/15 rounded-2xl px-4 py-3 pl-11 focus:outline-none focus:border-arcane/50 text-sm transition-colors text-parchment placeholder:text-parchment/30"
                  autoFocus
                />
                <LinkIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/30" />
                {urlInput && (
                  <button
                    type="button"
                    onClick={() => handleUrlChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-lg text-parchment/40 hover:text-parchment cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-parchment/40 font-mono">
                Cole o link direto da imagem (ex: https://i.imgur.com/exemplo.jpg)
              </p>
            </div>
          ) : activeTab === 'upload' ? (
            <div className="space-y-3">
              <label className="text-xs font-mono uppercase tracking-widest text-parchment/60 flex items-center gap-2">
                <Upload size={13} className="text-arcane" />
                Upload da imagem
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer text-center",
                  isDragging 
                    ? "border-arcane bg-arcane/10" 
                    : "border-white/15 hover:border-arcane/40 bg-white/5 hover:bg-white/[0.08]"
                )}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept="image/*"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-arcane/15 border border-arcane/30 flex items-center justify-center text-arcane">
                  <Upload size={22} />
                </div>
                <div>
                  <p className="font-serif text-sm text-parchment font-medium">
                    Clique para selecionar ou arraste uma imagem
                  </p>
                  <p className="text-[11px] text-parchment/40 font-mono mt-1">
                    Formatos aceitos: JPG, PNG, WEBP, GIF (redimensionamento otimizado)
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Camera Tab Content */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase tracking-widest text-parchment/60 flex items-center gap-2">
                  <Camera size={13} className="text-arcane" />
                  Capturar foto com a câmera
                </label>
                {!cameraError && (
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="flex items-center gap-1.5 text-[11px] font-mono text-parchment/50 hover:text-arcane transition-colors cursor-pointer"
                    title="Alternar entre câmera frontal e traseira"
                  >
                    <FlipHorizontal size={14} />
                    <span>{facingMode === 'user' ? 'Câmera Frontal' : 'Câmera Traseira'}</span>
                  </button>
                )}
              </div>

              {cameraError ? (
                <div className="p-6 rounded-2xl bg-ember/10 border border-ember/30 text-center space-y-3">
                  <VideoOff size={32} className="text-ember mx-auto" />
                  <p className="text-xs font-mono text-ember leading-relaxed">
                    {cameraError}
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="px-4 py-2 bg-ember/20 hover:bg-ember/30 text-ember border border-ember/40 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Tentar Novamente
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="px-4 py-2 bg-white/10 hover:bg-white/15 text-parchment/80 border border-white/20 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Usar Upload
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative aspect-square max-w-[280px] mx-auto rounded-3xl overflow-hidden border-2 border-arcane/30 bg-black/60 shadow-inner flex items-center justify-center group">
                    {cameraLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-2">
                        <Loader2 size={28} className="animate-spin text-arcane" />
                        <span className="text-xs font-mono text-parchment/60 uppercase tracking-widest">Iniciando câmera...</span>
                      </div>
                    )}

                    {shutterFlash && (
                      <div className="absolute inset-0 bg-white z-30 pointer-events-none animate-ping" />
                    )}

                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={cn(
                        "w-full h-full object-cover",
                        facingMode === 'user' && "-scale-x-100" // Mirror for selfie camera
                      )}
                    />

                    {/* Framing Guideline Overlay */}
                    <div className="absolute inset-4 rounded-2xl border border-white/20 pointer-events-none flex flex-col justify-between p-2">
                      <div className="flex justify-between">
                        <div className="w-3 h-3 border-t-2 border-l-2 border-arcane/60" />
                        <div className="w-3 h-3 border-t-2 border-r-2 border-arcane/60" />
                      </div>
                      <div className="flex justify-between">
                        <div className="w-3 h-3 border-b-2 border-l-2 border-arcane/60" />
                        <div className="w-3 h-3 border-b-2 border-r-2 border-arcane/60" />
                      </div>
                    </div>
                  </div>

                  {/* Camera Controls */}
                  <div className="flex items-center justify-center gap-4 pt-1">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="p-3 rounded-full glass hover:bg-white/10 text-parchment/60 hover:text-parchment transition-all cursor-pointer"
                      title="Reiniciar Câmera"
                    >
                      <RefreshCw size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={cameraLoading}
                      className="flex items-center justify-center w-16 h-16 rounded-full bg-arcane hover:scale-105 active:scale-95 transition-all text-obsidian shadow-lg shadow-arcane/30 border-4 border-obsidian cursor-pointer"
                      title="Capturar Foto"
                    >
                      <Camera size={26} />
                    </button>

                    <button
                      type="button"
                      onClick={toggleFacingMode}
                      className="p-3 rounded-full glass hover:bg-white/10 text-parchment/60 hover:text-parchment transition-all cursor-pointer"
                      title="Alternar Câmera"
                    >
                      <FlipHorizontal size={16} />
                    </button>
                  </div>
                  <p className="text-center text-[10px] font-mono text-parchment/40 uppercase tracking-widest">
                    Centralize o rosto no quadro e clique no botão para capturar
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-xl bg-ember/10 border border-ember/30 text-ember text-xs font-mono flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Image Preview */}
          {previewUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-parchment/40 uppercase tracking-widest">
                <span>Pré-visualização</span>
                <button
                  type="button"
                  onClick={() => { setPreviewUrl(''); setUrlInput(''); setError(null); }}
                  className="text-ember hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} /> Limpar
                </button>
              </div>
              <div className="relative aspect-video max-h-48 w-full rounded-2xl overflow-hidden border border-white/20 bg-black/40 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Preview"
                  onError={() => setError("Não foi possível carregar a imagem. Verifique se o link ou arquivo é válido.")}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 glass rounded-xl text-xs font-mono uppercase tracking-wider hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!previewUrl || isProcessing}
              onClick={handleConfirm}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 bg-arcane text-obsidian rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all shadow-lg shadow-arcane/20",
                (!previewUrl || isProcessing) 
                  ? "opacity-40 cursor-not-allowed" 
                  : "hover:scale-105 active:scale-95 cursor-pointer"
              )}
            >
              {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
