import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { safeGoBack } from '@/lib/utils';

export default function TermsPage() {
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

          <h1 className="text-xl font-bold text-foreground mb-4">Syarat & Ketentuan</h1>
          
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Terakhir diperbarui:</strong> 16 April 2026</p>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">1. Ketentuan Umum</h2>
              <p>
                Dengan menggunakan aplikasi DesaMart, Anda menyetujui syarat dan ketentuan berikut. 
                DesaMart adalah platform marketplace yang menghubungkan pembeli dengan UMKM desa.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">2. Akun Pengguna</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Anda harus berusia minimal 17 tahun atau memiliki izin orang tua</li>
                <li>Informasi akun harus akurat dan terkini</li>
                <li>Anda bertanggung jawab menjaga kerahasiaan password</li>
                <li>Satu orang hanya boleh memiliki satu akun pembeli</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">3. Pemesanan & Pembayaran</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Harga yang ditampilkan sudah termasuk harga produk, belum termasuk ongkir</li>
                <li>Pembayaran dapat dilakukan via transfer bank, QRIS, atau COD (area tertentu)</li>
                <li>Pesanan yang sudah dikonfirmasi merchant tidak dapat dibatalkan</li>
                <li>COD memiliki batas maksimal sesuai kebijakan masing-masing merchant</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">4. Pengiriman</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Estimasi pengiriman tergantung jarak dan ketersediaan kurir</li>
                <li>Biaya pengiriman dihitung berdasarkan jarak antara merchant dan alamat pembeli</li>
                <li>Pesanan otomatis selesai 24 jam setelah diterima jika tidak ada keluhan</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">5. Pengembalian & Refund</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Pengembalian dapat diajukan jika produk tidak sesuai deskripsi</li>
                <li>Bukti foto wajib dilampirkan saat mengajukan pengembalian</li>
                <li>Refund akan diproses dalam 3-7 hari kerja setelah disetujui</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">6. Merchant</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Merchant wajib mendaftarkan diri dan menunggu verifikasi admin</li>
                <li>Produk yang dijual harus sesuai dengan deskripsi dan foto</li>
                <li>Merchant bertanggung jawab atas kualitas dan kehalalan produk</li>
                <li>Platform berhak menonaktifkan toko yang melanggar ketentuan</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">7. Trust Score & COD</h2>
              <p>
                Sistem trust score digunakan untuk menilai kelayakan COD. 
                Pembeli yang menolak pesanan COD tanpa alasan valid akan mendapat pengurangan skor. 
                Jika skor di bawah batas minimum, fitur COD akan dinonaktifkan.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">8. Larangan</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Menjual produk ilegal, berbahaya, atau melanggar hukum</li>
                <li>Melakukan penipuan atau manipulasi transaksi</li>
                <li>Menyalahgunakan sistem review atau rating</li>
                <li>Menggunakan bot atau alat otomatis untuk mengakses platform</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mt-6 mb-2">9. Perubahan Ketentuan</h2>
              <p>
                DesaMart berhak mengubah syarat dan ketentuan ini sewaktu-waktu. 
                Perubahan akan diberitahukan melalui notifikasi aplikasi.
              </p>
            </section>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
