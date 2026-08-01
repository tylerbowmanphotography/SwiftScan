import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Image as ImageIcon, Zap, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureImage: (base64Image: string) => void;
  onScanBarcode: (code: string) => void;
  isLoading: boolean;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onCaptureImage,
  onScanBarcode,
  isLoading,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  useEffect(() => {
    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  useEffect(() => {
    if (stream && videoRef.current && readerRef.current && !isLoading) {
      const controlsPromise = readerRef.current.decodeFromVideoElementContinuously(
        videoRef.current,
        (result, error) => {
          if (result) {
            playChime();
            stopCamera();
            onScanBarcode(result.getText());
          }
        }
      );
      
      return () => {
        // Clean up decoding on unmount or stream change
        controlsPromise.catch(() => {});
      };
    }
  }, [stream, isLoading]);

  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {
      console.warn('Audio chime failed', e);
    }
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Check for torch track support
      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorch(true);
        }
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setCameraError('Unable to access camera. You can upload or select a photo instead.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const toggleFlash = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const nextState = !isFlashOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any],
        });
        setIsFlashOn(nextState);
      } catch (e) {
        console.warn('Flash error:', e);
      }
    }
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Play chime sound
    playChime();

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    stopCamera();
    onCaptureImage(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        stopCamera();
        onCaptureImage(result);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-md h-[90vh] max-h-[750px] bg-zinc-950 text-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-zinc-800"
        >
          {/* Hidden Canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Top Bar */}
          <div className="relative z-10 flex items-center justify-between p-4 bg-black/90 backdrop-blur-md border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-pink-600 text-white rounded-xl shadow-md">
                <Sparkles size={18} />
              </span>
              <div>
                <h3 className="font-bold text-sm leading-tight text-white">Smart Scanner</h3>
                <p className="text-[11px] font-medium text-slate-400">Scan product photo or UPC barcode</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleFlash}
                  className={`p-2.5 rounded-xl transition-colors border ${
                    isFlashOn
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                  title="Toggle Flash"
                >
                  <Zap size={18} />
                </button>
              )}

              <button
                type="button"
                onClick={toggleCameraFacing}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors"
                title="Flip Camera"
              >
                <RefreshCw size={18} />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Camera Viewfinder Area */}
          <div className="relative flex-1 bg-zinc-900 overflow-hidden flex items-center justify-center">
            {cameraError ? (
              <div className="p-6 text-center max-w-xs">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle size={24} />
                </div>
                <p className="text-sm text-zinc-300 mb-4">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-pink-600 hover:bg-pink-500 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-pink-600/30 flex items-center justify-center gap-2"
                >
                  <ImageIcon size={18} /> Choose Photo from Gallery
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Viewfinder Target Frame */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
                  <div className="relative w-64 h-64 border-2 border-dashed border-pink-400/70 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(236,72,153,0.2)]">
                    {/* Corner Reticles */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-pink-500 rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-pink-500 rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-pink-500 rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-pink-500 rounded-br-xl" />

                    {/* Animated Scanning Laser */}
                    <motion.div
                      animate={{ y: ['0%', '240%', '0%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-full h-1 bg-gradient-to-r from-transparent via-pink-400 to-transparent shadow-[0_0_15px_#ec4899]"
                    />
                  </div>
                  <p className="mt-4 text-xs font-medium text-zinc-300 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                    Snap a photo or hold UPC barcode in frame
                  </p>
                </div>
              </>
            )}

            {isLoading && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-20 overflow-hidden">
                {/* Full-screen scanning laser animation during analysis */}
                <motion.div
                  initial={{ y: '-10%' }}
                  animate={{ y: ['-10%', '110%', '-10%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent shadow-[0_0_30px_10px_rgba(236,72,153,0.4)] z-10"
                />
                
                <div className="relative w-16 h-16 mb-4 z-20">
                  <div className="absolute inset-0 rounded-full border-4 border-pink-500/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto text-pink-400 animate-pulse" size={24} />
                </div>
                <p className="text-sm font-semibold text-white z-20">Analyzing Product & Prices...</p>
                <p className="text-xs text-zinc-400 mt-1 z-20">Checking reviews and retailer prices</p>
              </div>
            )}
          </div>

          {/* Bottom Control Bar */}
          <div className="p-6 bg-zinc-950 flex items-center justify-between gap-4 border-t border-zinc-900">
            {/* Gallery Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white transition-colors p-2"
            >
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800">
                <ImageIcon size={20} />
              </div>
              <span className="text-[11px]">Upload</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Shutter Capture Button */}
            <button
              type="button"
              disabled={isLoading || !!cameraError}
              onClick={capturePhoto}
              className="relative p-1 bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border-4 border-zinc-950">
                <Camera size={26} className="text-zinc-900" />
              </div>
            </button>

            {/* Camera Switch Button */}
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white transition-colors p-2"
            >
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800">
                <RefreshCw size={20} />
              </div>
              <span className="text-[11px]">Flip</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
