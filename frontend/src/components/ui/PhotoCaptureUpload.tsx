import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RefreshCw, X, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from './Button.js';

export interface PhotoCaptureUploadProps {
  value?: string;
  onChange: (photoBase64: string) => void;
  required?: boolean;
  label?: string;
  className?: string;
}

export const PhotoCaptureUpload: React.FC<PhotoCaptureUploadProps> = ({
  value,
  onChange,
  required = false,
  label = 'Student Profile Photo',
  className = ''
}) => {
  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Compress & normalize image to lightweight data URL (max 600x600, JPEG 0.85)
  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          onChange(dataUrl);
        }
      };
      if (typeof e.target?.result === 'string') {
        img.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file (JPG or PNG).');
        return;
      }
      processImageFile(file);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser or environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera startup error:', err);
      setCameraError(err.message || 'Unable to access camera. Please check permissions or upload a photo file.');
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Mirror image for natural user preview
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      onChange(dataUrl);
      stopCamera();
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Label and Status */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
        {value ? (
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Photo Attached
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Photo Required
          </span>
        )}
      </div>

      {/* Mandatory Biometric Dining Warning Notice */}
      <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-lg text-xs leading-relaxed text-amber-900 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-amber-950 text-[11px] uppercase tracking-wide">
            Biometric Mess Recognition Notice
          </p>
          <p className="text-[11px] text-amber-900 leading-snug">
            Please provide a <strong>clear, recent front-facing photo</strong>. Your face will be biometrically scanned and matched against this registered profile photo at meal dining counters. If a clear recent photo is not registered, the scanner will fail to recognize you and meal entry will not be permitted.
          </p>
        </div>
      </div>

      {/* Photo Preview Card if Already Captured / Uploaded */}
      {value ? (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3.5">
          <div className="relative w-20 h-24 rounded-md overflow-hidden bg-slate-200 border border-slate-300 shrink-0 shadow-xs">
            <img src={value} alt="Student Profile Preview" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-xs font-bold text-slate-800 truncate">Registered Face Photo</p>
            <p className="text-[11px] text-slate-500 leading-tight">
              Ready for biometric recognition and digital resident ID card.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="xs"
                leftIcon={<RefreshCw className="w-3 h-3" />}
                onClick={() => {
                  onChange('');
                  setMode('upload');
                }}
              >
                Change Photo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                leftIcon={<X className="w-3 h-3" />}
                onClick={() => {
                  onChange('');
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Capture & Upload Widget */
        <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-3">
          {/* Mode Switch Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setMode('upload');
              }}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded transition flex items-center justify-center gap-1.5 ${
                mode === 'upload'
                  ? 'bg-white text-[#23395D] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Recent Photo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('camera');
                startCamera();
              }}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded transition flex items-center justify-center gap-1.5 ${
                mode === 'camera'
                  ? 'bg-white text-[#23395D] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Take Live Photo</span>
            </button>
          </div>

          {/* Mode 1: File Upload */}
          {mode === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-[#23395D] rounded-lg p-4 sm:p-5 text-center cursor-pointer transition bg-slate-50/50 hover:bg-slate-50 space-y-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-10 h-10 rounded-full bg-[#23395D]/10 text-[#23395D] flex items-center justify-center mx-auto">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Click to browse or drag and drop photo
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  JPG or PNG format • Maximum 5MB • Passport or clear portrait
                </p>
              </div>
            </div>
          )}

          {/* Mode 2: Live Camera Capture */}
          {mode === 'camera' && (
            <div className="space-y-2.5">
              {cameraError ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 space-y-2">
                  <p className="font-semibold">{cameraError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => startCamera()}
                  >
                    Retry Camera
                  </Button>
                </div>
              ) : (
                <div className="relative w-full max-w-xs mx-auto aspect-4/3 bg-slate-900 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover -scale-x-100"
                  />
                  {/* Face Guide Overlay */}
                  <div className="absolute inset-0 border-2 border-white/40 border-dashed rounded-full m-6 pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] text-white/80 bg-slate-900/60 px-2 py-0.5 rounded font-medium">
                      Align Face Here
                    </span>
                  </div>
                </div>
              )}

              {isCameraActive && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    leftIcon={<Camera className="w-4 h-4" />}
                    onClick={capturePhoto}
                  >
                    Snap Face Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      stopCamera();
                      setMode('upload');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
