import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, SwitchCamera, X, Barcode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetect: (barcode: string) => void;
}

export function BarcodeScanner({ open, onClose, onDetect }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState('');
  const [error, setError] = useState('');
  const cooldownRef = useRef(false);

  const stopScanning = useCallback(() => {
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch (_) {}
      controlsRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanning = useCallback(async (deviceId: string) => {
    if (!videoRef.current || !deviceId) return;
    stopScanning();
    setError('');
    const reader = new BrowserMultiFormatReader();
    try {
      const controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
        if (result && !cooldownRef.current) {
          const text = result.getText();
          cooldownRef.current = true;
          setLastResult(text);
          onDetect(text);
          setTimeout(() => {
            cooldownRef.current = false;
            setLastResult('');
          }, 1500);
        }
      });
      controlsRef.current = controls;
      setScanning(true);
    } catch (e: any) {
      setError('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.');
      setScanning(false);
    }
  }, [onDetect, stopScanning]);

  useEffect(() => {
    if (!open) {
      stopScanning();
      setDevices([]);
      setSelectedDevice('');
      setLastResult('');
      setError('');
      return;
    }

    (async () => {
      try {
        const videoDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(videoDevices);
        const back = videoDevices.find(d =>
          /back|rear|environment/i.test(d.label)
        );
        const deviceId = back?.deviceId || videoDevices[0]?.deviceId || '';
        setSelectedDevice(deviceId);
        if (deviceId) startScanning(deviceId);
      } catch (e) {
        setError('Tidak dapat mendeteksi kamera di perangkat ini.');
      }
    })();

    return () => stopScanning();
  }, [open]);

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDevice(deviceId);
    startScanning(deviceId);
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5 text-emerald-600" />
            Scan Barcode Produk
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-3">
          {/* Camera preview */}
          <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />

            {/* Corner brackets overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-52 h-52">
                <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                {/* Animated scan line */}
                <span
                  className="absolute inset-x-2 h-0.5 bg-emerald-400/80 rounded-full"
                  style={{ animation: 'scanLine 1.8s ease-in-out infinite', top: '50%' }}
                />
              </div>
            </div>

            {!scanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-center">
                  <Camera className="h-8 w-8 text-white/60 mx-auto mb-2" />
                  <p className="text-white/80 text-sm">Memulai kamera...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            {lastResult && (
              <div className="absolute bottom-2 inset-x-2 bg-emerald-600 rounded-lg px-3 py-2 text-center">
                <p className="text-white text-xs font-medium">✓ Terdeteksi: <span className="font-mono">{lastResult}</span></p>
              </div>
            )}
          </div>

          {/* Camera selector */}
          {devices.length > 1 && (
            <Select value={selectedDevice} onValueChange={handleDeviceChange}>
              <SelectTrigger className="h-9">
                <div className="flex items-center gap-2">
                  <SwitchCamera className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Pilih kamera" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {devices.map(d => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {d.label || `Kamera ${d.deviceId.slice(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Arahkan kamera ke barcode. Produk akan otomatis ditambahkan ke keranjang.
          </p>

          <Button variant="outline" className="w-full h-9" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            Tutup Scanner
          </Button>
        </div>
      </DialogContent>

      <style>{`
        @keyframes scanLine {
          0%, 100% { transform: translateY(-40px); opacity: 0.3; }
          50% { transform: translateY(40px); opacity: 1; }
        }
      `}</style>
    </Dialog>
  );
}
