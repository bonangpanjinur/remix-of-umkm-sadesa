import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Mail, Phone, ChevronDown } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FAQ_ITEMS = [
  {
    q: 'Bagaimana cara memesan produk?',
    a: 'Pilih produk yang diinginkan, tambahkan ke keranjang, lalu lanjutkan ke checkout. Isi alamat pengiriman dan pilih metode pembayaran.',
  },
  {
    q: 'Berapa lama pengiriman pesanan?',
    a: 'Estimasi pengiriman tergantung jarak antara toko dan alamat Anda. Umumnya 1-3 hari untuk area lokal.',
  },
  {
    q: 'Bagaimana cara membatalkan pesanan?',
    a: 'Buka halaman Pesanan Saya, pilih pesanan yang ingin dibatalkan, lalu klik tombol "Batalkan Pesanan". Pembatalan hanya bisa dilakukan sebelum pesanan diproses.',
  },
  {
    q: 'Metode pembayaran apa saja yang tersedia?',
    a: 'Kami menerima transfer bank, QRIS, dan COD (bayar di tempat) untuk area tertentu.',
  },
  {
    q: 'Bagaimana cara menjadi merchant/pedagang?',
    a: 'Buka menu Akun → Bergabung Bersama Kami → Daftar Sebagai Pedagang. Lengkapi data yang diperlukan dan tunggu persetujuan admin.',
  },
  {
    q: 'Bagaimana cara mengajukan refund?',
    a: 'Buka detail pesanan, klik "Ajukan Pengembalian", isi alasan dan lampirkan bukti foto jika diperlukan.',
  },
  {
    q: 'Apakah semua produk halal?',
    a: 'Kami mengutamakan produk halal. Cek badge sertifikat halal pada setiap produk untuk memastikan status halalnya.',
  },
];

export default function HelpPage() {
  const navigate = useNavigate();

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-5 py-4">
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Kembali</span>
          </button>

          <h1 className="text-xl font-bold text-foreground mb-1">Pusat Bantuan</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Temukan jawaban untuk pertanyaan umum
          </p>

          {/* FAQ */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pertanyaan Umum (FAQ)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Accordion type="single" collapsible className="w-full">
                {FAQ_ITEMS.map((item, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-sm text-left">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hubungi Kami</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <a
                href="https://wa.me/6281234567890"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition"
              >
                <MessageCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Chat langsung dengan CS</p>
                </div>
              </a>
              <a
                href="mailto:support@desamart.id"
                className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition"
              >
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Email</p>
                  <p className="text-xs text-muted-foreground">support@desamart.id</p>
                </div>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
