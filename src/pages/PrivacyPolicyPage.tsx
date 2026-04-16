import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { safeGoBack } from '@/lib/utils';

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-5 py-4">
          <button
            onClick={() => safeGoBack(navigate)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Kembali</span>
          </button>

          <h1 className="text-xl font-bold text-foreground mb-4">Kebijakan Privasi</h1>
          
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Terakhir diperbarui:</strong> 16 April 2026</p>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">1. Data yang Kami Kumpulkan</h2>
              <p>Kami mengumpulkan informasi berikut saat Anda menggunakan DesaMart:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Nama lengkap, email, dan nomor telepon saat pendaftaran akun</li>
                <li>Alamat pengiriman yang Anda simpan</li>
                <li>Riwayat pesanan dan transaksi</li>
                <li>Data lokasi (GPS) jika Anda mengizinkan, untuk mengurutkan produk terdekat</li>
                <li>Informasi perangkat dan browser untuk analitik</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">2. Penggunaan Data</h2>
              <p>Data Anda digunakan untuk:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Memproses dan mengirimkan pesanan Anda</li>
                <li>Menghubungi Anda terkait status pesanan</li>
                <li>Meningkatkan layanan dan pengalaman pengguna</li>
                <li>Menampilkan produk dan toko terdekat</li>
                <li>Mencegah penipuan dan menjaga keamanan platform</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">3. Perlindungan Data</h2>
              <p>
                Kami melindungi data Anda dengan enkripsi SSL/TLS, kebijakan akses berbasis peran (RLS), 
                dan penyimpanan data yang aman. Kami tidak menjual data pribadi Anda kepada pihak ketiga.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">4. Pembagian Data</h2>
              <p>Data Anda hanya dibagikan kepada:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Merchant terkait untuk memproses pesanan Anda</li>
                <li>Kurir untuk pengiriman pesanan</li>
                <li>Penyedia layanan pembayaran (untuk transaksi online)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">5. Hak Pengguna</h2>
              <p>Anda berhak untuk:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Mengakses dan memperbarui data pribadi Anda</li>
                <li>Meminta penghapusan akun dan data</li>
                <li>Menarik persetujuan penggunaan lokasi</li>
                <li>Mengajukan pertanyaan terkait data Anda</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">6. Cookie & Penyimpanan Lokal</h2>
              <p>
                Kami menggunakan penyimpanan lokal (localStorage) untuk menyimpan sesi login, 
                keranjang belanja, dan preferensi tema. Tidak ada cookie pelacakan pihak ketiga yang digunakan.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">7. Kontak</h2>
              <p>
                Untuk pertanyaan terkait privasi, silakan hubungi kami melalui halaman Bantuan 
                atau email ke tim support kami.
              </p>
            </section>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
