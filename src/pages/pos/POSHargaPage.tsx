import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle, Star, Zap, Crown,
  ShoppingCart, Package, Users, BarChart3,
  CreditCard, MessageSquare, Printer, Truck,
  FlaskConical, ChefHat, Table2, Tv2,
  UserCheck, DollarSign, Target, Globe,
  ArrowRight, Shield
} from 'lucide-react';

const PAKET = [
  {
    id: 'starter',
    icon: <Zap className="h-6 w-6" />,
    nama: 'Starter',
    harga: 99000,
    tagline: 'Cocok untuk warung & toko kecil',
    color: 'border-blue-200',
    badgeColor: 'bg-blue-100 text-blue-700',
    btnClass: 'bg-blue-600 hover:bg-blue-700',
    fitur: [
      { icon: <ShoppingCart className="h-4 w-4" />, label: '1 outlet' },
      { icon: <Users className="h-4 w-4" />, label: '2 pengguna kasir' },
      { icon: <Package className="h-4 w-4" />, label: 'Kasir + manajemen stok' },
      { icon: <BarChart3 className="h-4 w-4" />, label: 'Laporan penjualan dasar' },
      { icon: <Printer className="h-4 w-4" />, label: 'Print struk thermal' },
      { icon: <CreditCard className="h-4 w-4" />, label: 'Export CSV' },
    ],
    tidak: ['Bahan baku & resep', 'KDS dapur', 'Payroll karyawan', 'Hutang & piutang'],
    popular: false,
  },
  {
    id: 'bisnis',
    icon: <Star className="h-6 w-6" />,
    nama: 'Bisnis',
    harga: 249000,
    tagline: 'Terpopuler untuk restoran & kafe',
    color: 'border-emerald-400 ring-2 ring-emerald-400',
    badgeColor: 'bg-emerald-600 text-white',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700',
    fitur: [
      { icon: <ShoppingCart className="h-4 w-4" />, label: '3 outlet' },
      { icon: <Users className="h-4 w-4" />, label: '5 pengguna kasir' },
      { icon: <BarChart3 className="h-4 w-4" />, label: 'HPP + Laba Rugi + Cashflow' },
      { icon: <Truck className="h-4 w-4" />, label: 'Pembelian ke supplier' },
      { icon: <Star className="h-4 w-4" />, label: 'Loyalty + Voucher' },
      { icon: <MessageSquare className="h-4 w-4" />, label: 'Kirim struk via WhatsApp' },
      { icon: <CreditCard className="h-4 w-4" />, label: 'Export PDF semua laporan' },
      { icon: <UserCheck className="h-4 w-4" />, label: 'Absensi karyawan + Jadwal shift' },
      { icon: <Table2 className="h-4 w-4" />, label: 'Manajemen meja (10 meja)' },
      { icon: <Target className="h-4 w-4" />, label: 'Target omzet & tracking' },
      { icon: <DollarSign className="h-4 w-4" />, label: 'Hutang & piutang (AP/AR)' },
    ],
    tidak: ['Resep & bahan baku otomatis', 'Kitchen Display System (KDS)', 'Payroll karyawan', 'API integrasi marketplace'],
    popular: true,
  },
  {
    id: 'profesional',
    icon: <Crown className="h-6 w-6" />,
    nama: 'Profesional',
    harga: 499000,
    tagline: 'Untuk bisnis FnB skala besar',
    color: 'border-purple-200',
    badgeColor: 'bg-purple-100 text-purple-700',
    btnClass: 'bg-purple-600 hover:bg-purple-700',
    fitur: [
      { icon: <ShoppingCart className="h-4 w-4" />, label: 'Outlet tidak terbatas' },
      { icon: <Users className="h-4 w-4" />, label: 'User tidak terbatas' },
      { icon: <FlaskConical className="h-4 w-4" />, label: 'Resep & bahan baku (stok otomatis berkurang)' },
      { icon: <Tv2 className="h-4 w-4" />, label: 'Kitchen Display System (KDS)' },
      { icon: <ChefHat className="h-4 w-4" />, label: 'Payroll karyawan otomatis' },
      { icon: <DollarSign className="h-4 w-4" />, label: 'Hutang & piutang lengkap' },
      { icon: <BarChart3 className="h-4 w-4" />, label: 'Export ke Accurate/MYOB/Zahir' },
      { icon: <Globe className="h-4 w-4" />, label: 'API integrasi marketplace' },
      { icon: <Shield className="h-4 w-4" />, label: 'Audit trail & manajemen akses' },
    ],
    tidak: [],
    popular: false,
  },
];

function fmtRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default function POSHargaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      {/* Navbar minimal */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-emerald-600 text-lg">
            <ShoppingCart className="h-5 w-5" /> DesaMart POS
          </Link>
          <div className="flex gap-2">
            <Link to="/auth"><Button variant="outline" size="sm">Masuk</Button></Link>
            <Link to="/merchant/pos/subscribe"><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">Mulai Gratis</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
        <Badge className="mb-4 bg-emerald-100 text-emerald-700 border-0 px-3 py-1">Sistem Kasir SaaS Terbaik untuk UMKM</Badge>
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
          Harga Transparan,<br/>
          <span className="text-emerald-600">Tanpa Biaya Tersembunyi</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
          Pilih paket yang sesuai kebutuhan bisnis FnB Anda. Mulai trial gratis 30 hari, tanpa kartu kredit.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <CheckCircle className="h-4 w-4 text-emerald-500" /> Trial gratis 30 hari
          <CheckCircle className="h-4 w-4 text-emerald-500 ml-3" /> Tanpa biaya setup
          <CheckCircle className="h-4 w-4 text-emerald-500 ml-3" /> Batalkan kapan saja
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PAKET.map(p => (
            <div key={p.id} className={`rounded-2xl border-2 bg-white shadow-sm p-6 flex flex-col relative ${p.color}`}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-emerald-600 text-white px-4 py-1 text-sm shadow">⭐ Terpopuler</Badge>
                </div>
              )}
              <div className="flex items-center gap-3 mb-4 mt-1">
                <div className={`p-2 rounded-lg ${p.badgeColor}`}>{p.icon}</div>
                <div>
                  <h3 className="font-bold text-xl">{p.nama}</h3>
                  <p className="text-xs text-muted-foreground">{p.tagline}</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-extrabold">{fmtRp(p.harga)}</span>
                  <span className="text-muted-foreground text-sm mb-1">/bulan</span>
                </div>
                <p className="text-xs text-muted-foreground">Hemat 20% bayar tahunan</p>
              </div>

              <Link to="/merchant/pos/subscribe" className="block mb-6">
                <Button className={`w-full ${p.btnClass}`} size="lg">
                  Mulai Trial Gratis <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>

              <div className="space-y-2 flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Yang Anda dapatkan:</p>
                {p.fitur.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{f.label}</span>
                  </div>
                ))}
                {p.tidak.length > 0 && (
                  <>
                    <div className="pt-2 border-t border-dashed border-border mt-3"/>
                    {p.tidak.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <div className="h-4 w-4 shrink-0 mt-0.5 flex items-center justify-center">
                          <div className="h-0.5 w-3 bg-muted-foreground/40 rounded"/>
                        </div>
                        <span className="line-through opacity-50">{f}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Perbandingan Fitur Lengkap</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-4 font-semibold">Fitur</th>
                {PAKET.map(p => (
                  <th key={p.id} className="text-center p-4 font-semibold">{p.nama}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Kasir & transaksi', true, true, true],
                ['Manajemen stok', true, true, true],
                ['Laporan penjualan', true, true, true],
                ['Export PDF & CSV', '—', true, true],
                ['Struk via WhatsApp', '—', true, true],
                ['Loyalty & voucher', '—', true, true],
                ['Pembelian ke supplier', '—', true, true],
                ['Manajemen meja', '—', true, true],
                ['Absensi karyawan', '—', true, true],
                ['Jadwal shift', '—', true, true],
                ['Target omzet', '—', true, true],
                ['Hutang & piutang', '—', true, true],
                ['Penggajian / Payroll', '—', '—', true],
                ['Resep & bahan baku otomatis', '—', '—', true],
                ['Kitchen Display System (KDS)', '—', '—', true],
                ['Multi-outlet tidak terbatas', '—', '—', true],
                ['API integrasi marketplace', '—', '—', true],
                ['Audit trail & akses kontrol', '—', '—', true],
              ].map(([label, ...vals], i) => (
                <tr key={i} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                  <td className="p-4 font-medium text-gray-700">{label}</td>
                  {vals.map((v, j) => (
                    <td key={j} className="text-center p-4">
                      {v === true ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground/40 text-lg">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Pertanyaan Umum</h2>
        <div className="space-y-4">
          {[
            { q: 'Apakah ada kontrak jangka panjang?', a: 'Tidak. Anda berlangganan bulanan dan bisa berhenti kapan saja tanpa biaya penalti.' },
            { q: 'Bagaimana jika saya ingin upgrade paket?', a: 'Upgrade bisa dilakukan kapan saja dari halaman pengaturan akun. Selisih biaya akan dihitung secara proporsional.' },
            { q: 'Apakah data saya aman?', a: 'Data Anda tersimpan aman di server Replit dengan enkripsi penuh. Kami tidak pernah menjual data Anda kepada pihak ketiga.' },
            { q: 'Apakah bisa digunakan tanpa internet?', a: 'Mode POS kasir mendukung offline mode terbatas dengan PWA. Data akan disinkronkan otomatis saat koneksi kembali.' },
            { q: 'Apakah ada biaya setup atau pelatihan?', a: 'Tidak ada biaya setup. Dokumentasi dan video tutorial tersedia gratis. Tim support kami siap membantu via WhatsApp.' },
          ].map((faq, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <p className="font-semibold text-gray-800 mb-1">{faq.q}</p>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 pb-20 text-center">
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardContent className="p-10">
            <h2 className="text-2xl font-bold mb-3">Siap untuk memulai?</h2>
            <p className="text-muted-foreground mb-6">Bergabung dengan ribuan UMKM yang sudah menggunakan DesaMart POS. Trial gratis 30 hari, tanpa perlu kartu kredit.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/merchant/pos/subscribe">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 px-8">
                  Mulai Trial Gratis 30 Hari <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline">Sudah punya akun? Masuk</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-white py-6 text-center text-xs text-muted-foreground">
        © 2025 DesaMart · Platform UMKM & Desa Wisata Indonesia ·{' '}
        <Link to="/privacy" className="hover:underline">Privasi</Link> ·{' '}
        <Link to="/terms" className="hover:underline">Syarat Layanan</Link>
      </footer>
    </div>
  );
}
