import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Share2, Copy, Check, QrCode, Printer } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface StoreQRCodeProps {
  merchantId: string;
  merchantName: string;
  merchantImage?: string | null;
}

export function StoreQRCode({ merchantId, merchantName, merchantImage }: StoreQRCodeProps) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  
  // Use published URL for production, preview for development
  const baseUrl = window.location.origin;
  const storeUrl = `${baseUrl}/store/${merchantId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      toast({ title: 'Link toko berhasil disalin' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Gagal menyalin link', variant: 'destructive' });
    }
  };

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      // Set canvas size with padding for branding
      const padding = 40;
      const textHeight = 80;
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2 + textHeight;

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw QR code
      ctx.drawImage(img, padding, padding);

      // Add store name
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(merchantName, canvas.width / 2, img.height + padding + 35);

      // Add "Scan untuk kunjungi toko"
      ctx.fillStyle = '#666666';
      ctx.font = '16px system-ui, -apple-system, sans-serif';
      ctx.fillText('Scan untuk kunjungi toko', canvas.width / 2, img.height + padding + 60);

      // Download
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `qr-${merchantName.replace(/\s+/g, '-').toLowerCase()}.png`;
      downloadLink.click();

      URL.revokeObjectURL(url);
      toast({ title: 'QR Code berhasil diunduh' });
    };
    img.src = url;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Gagal membuka jendela print', variant: 'destructive' });
      return;
    }

    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${merchantName}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .container {
              text-align: center;
              padding: 40px;
              border: 2px dashed #e5e5e5;
              border-radius: 16px;
            }
            .qr-code {
              margin-bottom: 20px;
            }
            h1 {
              margin: 0 0 8px 0;
              font-size: 24px;
              color: #1a1a1a;
            }
            p {
              margin: 0;
              color: #666;
              font-size: 14px;
            }
            .url {
              margin-top: 16px;
              font-size: 12px;
              color: #999;
              word-break: break-all;
            }
            @media print {
              .container {
                border: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="qr-code">${svgData}</div>
            <h1>${merchantName}</h1>
            <p>Scan QR Code untuk mengunjungi toko kami</p>
            <p class="url">${storeUrl}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: merchantName,
          text: `Kunjungi toko ${merchantName} di DesaMart`,
          url: storeUrl,
        });
      } catch (err) {
        // User cancelled or error
        if ((err as Error).name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="h-4 w-4 mr-2" />
          QR Code Toko
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code Toko</DialogTitle>
          <DialogDescription>
            Gunakan QR Code ini untuk promosi offline. Pelanggan dapat scan untuk langsung mengunjungi toko Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          {/* QR Code Display */}
          <Card className="mb-4">
            <CardContent className="p-6" ref={qrRef}>
              <QRCodeSVG
                value={storeUrl}
                size={200}
                level="H"
                includeMargin
                imageSettings={merchantImage ? {
                  src: merchantImage,
                  height: 40,
                  width: 40,
                  excavate: true,
                } : undefined}
              />
            </CardContent>
          </Card>

          <p className="text-sm font-medium mb-1">{merchantName}</p>
          <p className="text-xs text-muted-foreground mb-4 text-center break-all px-4">
            {storeUrl}
          </p>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 w-full">
            <Button variant="outline" onClick={handleCopyLink}>
              {copied ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copied ? 'Tersalin' : 'Salin Link'}
            </Button>
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Bagikan
            </Button>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Unduh PNG
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Cetak
            </Button>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-1">💡 Tips Penggunaan:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Cetak dan tempel di kemasan produk</li>
            <li>Pasang di etalase atau meja kasir</li>
            <li>Sertakan di kartu nama atau brosur</li>
            <li>Bagikan di media sosial</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
