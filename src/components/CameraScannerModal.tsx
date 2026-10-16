import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Image as ImageIcon, Zap, AlertCircle, Sparkles, Search, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';

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

  const streamRef = useRef<MediaStream | null>(null);
  const startTokenRef = useRef(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [snapshotPreview, setSnapshotPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!readerRef.current) {
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      readerRef.current = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
    }
  }, []);

  // Handle camera start/stop on open/close
  useEffect(() => {
    if (isOpen) {
      setSnapshotPreview(null);
      startCamera();
    } else {
      stopCamera();
      setSnapshotPreview(null);
      setCameraError(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Keep video source synced with media stream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.warn('Video autoPlay prevented:', err);
      });
    }
  }, [stream]);

  // Active continuous barcode detection
  useEffect(() => {
    let controls: any = null;
    let isCancelled = false;

    if (stream && videoReady && videoRef.current && readerRef.current && !isLoading && !snapshotPreview) {
      const vid = videoRef.current;
      // Only start decoding once the video is actually producing frames
      if (vid.readyState >= 2 || vid.videoWidth > 0) {
        try {
          readerRef.current
            .decodeFromVideoElement(vid, (result, error, ctrls) => {
              if (isCancelled) return;
              if (result) {
                playChime();
                if (ctrls) {
                  try { ctrls.stop(); } catch (e) { /* ignore */ }
                } else if (controls) {
                  try { controls.stop(); } catch (e) { /* ignore */ }
                }
                captureSnapshotOnly();
                const text = result.getText ? result.getText() : String(result);
                if (text && text.trim()) {
                  onScanBarcode(text.trim());
                }
              }
            })
            .then((c) => {
              if (isCancelled) {
                try { c?.stop(); } catch (e) {}
              } else {
                controls = c;
              }
            })
            .catch((err) => {
              if (!isCancelled) {
                console.warn('ZXing decode warning:', err);
              }
            });
        } catch (err) {
          console.warn('Barcode scanner init error:', err);
        }
      }
    }

    return () => {
      isCancelled = true;
      if (controls) {
        try {
          controls.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [stream, videoReady, isLoading, snapshotPreview]);

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.05);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {
      // Audio chime is purely decorative - silently ignore failures
    }
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    const token = ++startTokenRef.current;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported or permission is blocked in this browser.');
      }

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (e) {
        // Fallback for devices with strict constraints
        console.warn('Retrying camera with generic constraints...', e);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      // The modal was closed / camera flipped while the permission prompt was open
      if (token !== startTokenRef.current) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((e) => console.warn('Video play error:', e));
      }

      // Check for torch track support
      try {
        const track = mediaStream.getVideoTracks()[0];
        if (track) {
          const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
          if (capabilities.torch) {
            setHasTorch(true);
          }
        }
      } catch (e) {
        // ignore capability check error
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Camera access unavailable. You can upload a photo or search by product name.');
    }
  };

  const stopCamera = () => {
    // Use the ref (not state) so cleanup closures always stop the live stream
    startTokenRef.current++;
    const current = streamRef.current;
    if (current) {
      current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      streamRef.current = null;
    }
    setStream(null);
    setVideoReady(false);
    setIsFlashOn(false);
    setHasTorch(false);
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

  const captureSnapshotOnly = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      const width = video.videoWidth > 0 ? video.videoWidth : 640;
      const height = video.videoHeight > 0 ? video.videoHeight : 480;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx && width > 0 && height > 0) {
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setSnapshotPreview(dataUrl);
      }
    } catch (e) {
      console.warn('Snapshot capture warning:', e);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    playChime();

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');

      const width = video.videoWidth > 0 ? video.videoWidth : 640;
      const height = video.videoHeight > 0 ? video.videoHeight : 480;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Save snapshot in state so the user sees the frozen photo being scanned
      setSnapshotPreview(dataUrl);

      // Trigger parent capture handler
      onCaptureImage(dataUrl);
    } catch (err: any) {
      console.warn('Capture error:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so user can pick the same file again if desired
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setCameraError('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setSnapshotPreview(result);
        onCaptureImage(result);
      }
    };
    reader.onerror = () => {
      setCameraError('Failed to read the selected image file. Please try again.');
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
              {hasTorch && !cameraError && (
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

              {!cameraError && (
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors"
                  title="Flip Camera"
                >
                  <RefreshCw size={18} />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors"
                title="Close Scanner"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Camera Viewfinder Area */}
          <div className="relative flex-1 bg-zinc-900 overflow-hidden flex items-center justify-center">
            {cameraError && !snapshotPreview ? (
              <div className="p-6 text-center max-w-xs space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                  <AlertCircle size={28} />
                </div>
                <div>
                  <h4 className="font-bold text-base text-white">Camera Unavailable</h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{cameraError}</p>
                </div>
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-pink-600/30 flex items-center justify-center gap-2"
                  >
                    <ImageIcon size={18} />
                    <span>Upload Photo from Gallery</span>
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl transition-all border border-zinc-700 flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} />
                    <span>Retry Camera Access</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Live Video Feed */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedData={() => setVideoReady(true)}
                  onPlaying={() => setVideoReady(true)}
                  className={`w-full h-full object-cover ${snapshotPreview ? 'opacity-0' : 'opacity-100'}`}
                />

                {/* Frozen Snapshot Preview during analysis */}
                {snapshotPreview && (
                  <img
                    src={snapshotPreview}
                    alt="Captured Scan Preview"
                    className="absolute inset-0 w-full h-full object-cover z-10"
                  />
                )}

                {/* Viewfinder Target Frame (when not analyzing) */}
                {!isLoading && !snapshotPreview && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
                    <div className="relative w-64 h-64 border-2 border-dashed border-pink-400/70 rounded-3xl overflow-hidden shadow-[0_0_50px_color-mix(in_srgb,var(--color-pink-600)_20%,transparent)]">
                      {/* Corner Reticles */}
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-pink-500 rounded-tl-xl" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-pink-500 rounded-tr-xl" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-pink-500 rounded-bl-xl" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-pink-500 rounded-br-xl" />

                      {/* Animated Scanning Laser */}
                      <motion.div
                        animate={{ y: ['0%', '240%', '0%'] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-full h-1 bg-gradient-to-r from-transparent via-pink-400 to-transparent shadow-[0_0_15px_var(--color-pink-500)]"
                      />
                    </div>
                    <p className="mt-4 text-xs font-medium text-zinc-300 bg-black/60 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
                      Snap photo or frame barcode
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Analysis In Progress Overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center z-20 overflow-hidden px-6 text-center">
                {/* Full-screen scanning laser animation during analysis */}
                <motion.div
                  initial={{ y: '-10%' }}
                  animate={{ y: ['-10%', '110%', '-10%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-pink-400 to-transparent shadow-[0_0_35px_12px_color-mix(in_srgb,var(--color-pink-500)_50%,transparent)] z-10"
                />
                
                <div className="relative w-16 h-16 mb-4 z-20">
                  <div className="absolute inset-0 rounded-full border-4 border-pink-500/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto text-pink-400 animate-pulse" size={24} />
                </div>
                <h4 className="text-base font-bold text-white z-20">Identifying Product with AI...</h4>
                <p className="text-xs text-zinc-300 mt-1 z-20 max-w-xs">
                  Identifying the product and estimating prices
                </p>
              </div>
            )}
          </div>

          {/* Quick Test Barcodes Bar */}
          <div className="p-2.5 bg-zinc-950/90 border-t border-zinc-900 flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold text-zinc-300 scrollbar-none">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold shrink-0 pl-2">Test Barcodes:</span>
            {[
              { label: '🥤 Diet Coke', code: '0049000028911' },
              { label: '📚 C Book', code: '9780131103627' },
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                disabled={isLoading}
                onClick={() => {
                  playChime();
                  onScanBarcode(item.code);
                }}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-pink-600 hover:text-white border border-zinc-800 rounded-lg shrink-0 transition-all active:scale-95 text-zinc-300 disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Bottom Control Bar */}
          <div className="p-5 bg-zinc-950 flex items-center justify-between gap-4 border-t border-zinc-900">
            {/* Gallery Upload Button */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white transition-colors p-2 disabled:opacity-50"
              title="Upload photo from device gallery"
            >
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-pink-600/50 transition-colors">
                <ImageIcon size={20} />
              </div>
              <span className="text-[11px] font-medium">Gallery</span>
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
              disabled={isLoading || (!!cameraError && !snapshotPreview)}
              onClick={capturePhoto}
              className="relative p-1 bg-gradient-to-r from-pink-600 via-pink-400 to-pink-700 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
              title="Take Photo of Product"
            >
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border-4 border-zinc-950">
                <Camera size={26} className="text-zinc-900" />
              </div>
            </button>

            {/* Camera Switch Button or Close */}
            <button
              type="button"
              disabled={isLoading || !!cameraError}
              onClick={toggleCameraFacing}
              className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white transition-colors p-2 disabled:opacity-50"
              title="Flip front/back camera"
            >
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-pink-600/50 transition-colors">
                <RefreshCw size={20} />
              </div>
              <span className="text-[11px] font-medium">Flip</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
