"use client";

import { useState } from "react";

type Section = "overview" | "telegram" | "import" | "users" | "sekolah" | "supplier" | "alokasi" | "faq";

const sections: { id: Section; icon: string; title: string }[] = [
  { id: "overview", icon: "🏠", title: "Ikhtisar Sistem" },
  { id: "telegram", icon: "🤖", title: "Telegram Bot" },
  { id: "import", icon: "📥", title: "Import Data" },
  { id: "users", icon: "👥", title: "Tim & Akses" },
  { id: "sekolah", icon: "🏫", title: "Sekolah" },
  { id: "supplier", icon: "🛒", title: "Supplier" },
  { id: "alokasi", icon: "⚙️", title: "Alokasi MBG" },
  { id: "faq", icon: "❓", title: "FAQ Cepat" },
];

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start bg-blue-50 border border-blue-100 rounded-xl p-4 my-3">
      <span className="text-blue-500 text-lg shrink-0 mt-0.5">💡</span>
      <div className="text-sm text-blue-900 leading-relaxed">{children}</div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-xl p-4 my-3">
      <span className="text-amber-500 text-lg shrink-0 mt-0.5">⚠️</span>
      <div className="text-sm text-amber-900 leading-relaxed">{children}</div>
    </div>
  );
}

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 items-start mb-5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-black shrink-0 shadow-md">{num}</div>
      <div className="flex-1">
        <h4 className="font-bold text-gray-900 text-sm mb-1">{title}</h4>
        <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function SectionOverview() {
  return (
    <div className="space-y-4">
      <p className="text-gray-700 leading-relaxed">Settings Web adalah pusat setup awal dan master data. Gunakan Web untuk konfigurasi sekolah, supplier, alokasi anggaran, akun tim, serta import data historis.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {[
          { icon: "👤", title: "Identitas SPPG", desc: "Kelola profil tenant, kontak, dan detail usaha." },
          { icon: "🏫", title: "Sekolah", desc: "Tambah sekolah dan hitung jumlah penerima MBG." },
          { icon: "🛒", title: "Supplier", desc: "Simpan vendor, kategori, dan status pajak." },
          { icon: "📥", title: "Import Data", desc: "Masukkan harga historis untuk analitik tanpa mengubah stok." },
          { icon: "⚙️", title: "Alokasi MBG", desc: "Atur alokasi biaya per porsi dan insentif harian." },
          { icon: "👥", title: "Tim & Akses", desc: "Kelola akun tim dan hak akses Web/Telegram." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <Tip>Setup rapi di Settings memastikan input Telegram dan laporan Web berjalan sinkron tanpa data ganda.</Tip>
    </div>
  );
}

function SectionTelegram() {
  return (
    <div className="space-y-4">
      <p className="text-gray-700 leading-relaxed">Gunakan tab Telegram untuk membuat kode link dan menghubungkan akun Telegram Anda. Setelah terhubung, bot akan bisa mengirim notifikasi dan menerima perintah operasional.</p>
      <div className="bg-slate-900 text-green-400 rounded-2xl p-5 font-mono text-sm space-y-2 shadow-inner">
        <p className="text-gray-400">── Perintah Telegram Utama ──</p>
        <p><span className="text-cyan-400">/start</span> — Mulai bot dan lihat menu utama</p>
        <p><span className="text-cyan-400">/belanja</span> — Catat belanja via foto nota atau manual</p>
        <p><span className="text-cyan-400">/serah</span> — Laporkan penyerahan MBG</p>
        <p><span className="text-cyan-400">/stok</span> — Cek stok bahan</p>
        <p><span className="text-cyan-400">/menu</span> — Lihat jadwal menu</p>
        <p><span className="text-cyan-400">/laporan</span> — Generate laporan</p>
        <p><span className="text-cyan-400">/help</span> — Bantuan lengkap</p>
      </div>
      <Step num={1} title="Generate Kode Link">Tekan tombol Generate Kode Token di tab Telegram.</Step>
      <Step num={2} title="Kirim Kode ke Bot">Buka @MbgCateringBot, kirim /start <span className="font-mono">[kode]</span>, lalu ikuti instruksi.</Step>
      <Step num={3} title="Periksa Koneksi">Pastikan bot menampilkan pesan sukses dan mulai menerima perintah serta notifikasi.</Step>
      <Warning>Jika kode sudah tidak valid, buat kode baru dari tab Telegram sebelum menghubungkan kembali.</Warning>
    </div>
  );
}

function SectionImport() {
  return (
    <div className="space-y-4">
      <p className="text-gray-700 leading-relaxed">Import Data membantu memasukkan harga belanja historis ke dalam sistem tanpa mengubah stok. Gunakan ini untuk memperbaiki grafik harga dan analisa biaya.</p>
      <Step num={1} title="Download Template CSV">Gunakan template resmi agar kolom tanggal, nama bahan, qty, dan harga sesuai format.</Step>
      <Step num={2} title="Upload dan Preview">Sistem akan verifikasi data dan menunjukkan baris yang valid atau bermasalah.</Step>
      <Step num={3} title="Eksekusi Import">Jika preview valid, lanjutkan import untuk menambahkan data history ke laporan.</Step>
      <Tip>Selalu cek nama bahan dan tanggal sebelum mengeksekusi import agar data historis akurat.</Tip>
    </div>
  );
}

function SectionUsers() {
  return (
    <div className="space-y-4">
      <p className="text-gray-700 leading-relaxed">Tab Tim & Akses mengelola akun tim, peran, dan status aktif. Akun baru perlu dibuat di sini lalu bisa di-link Telegram setelah login Web.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { title: "Admin", desc: "Akses hampir semua fitur, kecuali kelola owner." },
          { title: "Kasir", desc: "Input transaksi harian dan lihat laporan." },
          { title: "Viewer", desc: "Lihat dashboard dan laporan tanpa mengubah data." },
          { title: "Driver", desc: "Lihat jadwal pengiriman dan sekolah." },
        ].map((item, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
            <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
          </div>
        ))}
      </div>
      <Tip>User baru harus login Web terlebih dahulu, lalu link Telegram dengan perintah /start [kode] jika memakai bot.</Tip>
      <Warning>Gunakan role Viewer untuk akses monitoring saja dan role Admin hanya untuk pengguna yang butuh konfigurasi.</Warning>
    </div>
  );
}

function SectionSekolah() {
  return (
    <div className="space-y-4">
      <p className="text-gray-700 leading-relaxed">Tab Sekolah menyimpan daftar sekolah penerima MBG. Data jumlah penerima penting untuk menghitung porsi, biaya, dan piutang.</p>
      <Step num={1} title="Tambah Sekolah Baru">Isi nama sekolah, alamat, kontak, dan default porsi penerima.</Step>
      <Step num={2} title="Kelola Penerima">Ubah jumlah siswa/kategori penerima pada setiap sekolah sesuai data terbaru.</Step>
      <Step num={3} title="Update Berkala">Perbarui data saat ada penambahan lokasi atau perubahan jumlah penerima agar laporan akurat.</Step>
      <Tip>Perubahan sekolah harus dilakukan sebelum input /serah di Telegram untuk menghitung porsi tepat.</Tip>
    </div>
  );
}

function SectionSupplier() {
  return (
    <div className="space-y-4">
      <p className="text-gray-700 leading-relaxed">Tab Supplier menampung vendor dan status pajak. Supplier yang benar mempercepat pencatatan belanja dan menghasilkan laporan biaya yang lebih akurat.</p>
      <Step num={1} title="Tambah Supplier">Simpan nama, kategori, alamat, telepon, dan status PKP supplier.</Step>
      <Step num={2} title="Pilih Supplier yang Sudah Ada">Gunakan kembali supplier yang sama untuk konsistensi data belanja.</Step>
      <Step num={3} title="Perbarui Status PKP">Jaga data pajak tetap akurat agar laporan PPN/PPH valid.</Step>
      <Warning>Supplier baru yang tidak tercatat dapat membuat catatan pembukuan menjadi kurang lengkap.</Warning>
    </div>
  );
}

function SectionAlokasi() {
  return (
    <div className="space-y-4">
      <p className="text-gray-700 leading-relaxed">Tab Alokasi MBG menentukan struktur anggaran per porsi dan insentif harian. Nilai di sini dipakai untuk proyeksi biaya, bukan transaksi langsung.</p>
      <Step num={1} title="Atur Bahan per Porsi">Masukkan alokasi biaya bahan untuk SD/SMP dan PAUD/TK sesuai juknis.</Step>
      <Step num={2} title="Atur Operasional per Porsi">Isi komponen biaya operasional agar estimasi anggaran lebih realistis.</Step>
      <Step num={3} title="Tetapkan Insentif Harian">Tentukan insentif tetap per hari untuk pengelola dapur.</Step>
      <Tip>Perubahan alokasi mempengaruhi proyeksi anggaran, jadi sesuaikan saat kebijakan atau volume porsi berubah.</Tip>
    </div>
  );
}

function SectionFAQ() {
  return (
    <div className="space-y-4">
      <p className="text-gray-700 leading-relaxed">Jawaban cepat untuk pertanyaan umum tentang penggunaan Settings Web dan integrasi Telegram.</p>
      <div className="space-y-3">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
          <p className="font-semibold text-gray-900">Apakah data sekolah harus dibuat sebelum /serah?</p>
          <p className="text-sm text-gray-600 mt-2">Ya. Data sekolah perlu ada agar sistem dapat menghitung jumlah porsi dan piutang MBG dengan benar.</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
          <p className="font-semibold text-gray-900">Apakah import CSV mempengaruhi stok?</p>
          <p className="text-sm text-gray-600 mt-2">Tidak. Import Data hanya menambah data harga historis untuk analisis, tanpa mengubah stok bahan.</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
          <p className="font-semibold text-gray-900">Bagaimana mengubah role user?</p>
          <p className="text-sm text-gray-600 mt-2">Ubah role di tab Tim & Akses. Gunakan Admin untuk pengaturan dan Viewer untuk monitoring saja.</p>
        </div>
      </div>
    </div>
  );
}

export function TabTips() {
  const [active, setActive] = useState<Section>("overview");

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">📖</span>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Panduan & Tips Penggunaan</h2>
          <p className="text-sm text-gray-500">Pelajari cara menggunakan fitur Settings Web dan integrasi dengan Telegram.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-56 shrink-0">
          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible no-scrollbar bg-gray-50 lg:bg-transparent rounded-2xl lg:rounded-none p-2 lg:p-0 border border-gray-100 lg:border-0">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 text-left ${
                  active === s.id
                    ? "bg-white text-indigo-700 shadow-md ring-1 ring-indigo-100 scale-[1.02]"
                    : "text-gray-500 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                <span className="text-base">{s.icon}</span>
                <span>{s.title}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm min-h-[400px]">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
              <span className="text-xl">{sections.find(s => s.id === active)?.icon}</span>
              {sections.find(s => s.id === active)?.title}
            </h3>
            {active === "overview" && <SectionOverview />}
            {active === "telegram" && <SectionTelegram />}
            {active === "import" && <SectionImport />}
            {active === "users" && <SectionUsers />}
            {active === "sekolah" && <SectionSekolah />}
            {active === "supplier" && <SectionSupplier />}
            {active === "alokasi" && <SectionAlokasi />}
            {active === "faq" && <SectionFAQ />}
          </div>
        </div>
      </div>
    </div>
  );
}
