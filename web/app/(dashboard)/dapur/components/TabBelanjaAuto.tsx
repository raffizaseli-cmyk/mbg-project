"use client";

import { useState, useEffect, useMemo } from "react";
import { apiPost } from "@/lib/api";
import { Rupiah } from "@/components/ui/rupiah";

interface ParsedBelanja {
  name: string;
  qty: number;
  unit: string;
  price: number;
  subtotal: number;
}

export function TabBelanjaAuto() {
  const [belanjaText, setBelanjaText] = useState("");
  const [parsedBelanja, setParsedBelanja] = useState<ParsedBelanja[]>([]);
  const [belanjaErrors, setBelanjaErrors] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("tunai");
  const [saving, setSaving] = useState(false);
  
  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  }, []);
  const [dueDate, setDueDate] = useState(defaultDueDate);

  useEffect(() => {
    if (!belanjaText.trim()) {
      setParsedBelanja([]);
      setBelanjaErrors([]);
      return;
    }
    const lines = belanjaText.split("\n").map(l => l.trim()).filter(l => l);
    const parsed: ParsedBelanja[] = [];
    const errs: string[] = [];

    lines.forEach(line => {
      const parts = line.split(" ");
      if (parts.length < 4) {
        errs.push(`Format salah: "${line}" (butuh 4 kata)`);
        return;
      }
      const priceStr = parts.pop()!;
      const unitStr = parts.pop()!;
      const qtyStr = parts.pop()!;
      const nameStr = parts.join(" ");

      const qty = parseFloat(qtyStr.replace(/,/g, '.'));
      const price = parseFloat(priceStr.replace(/[^0-9.-]+/g, ""));

      if (isNaN(qty) || isNaN(price)) {
        errs.push(`Angka tidak valid: "${line}"`);
        return;
      }

      parsed.push({
        name: nameStr,
        qty,
        unit: unitStr.toLowerCase(),
        price,
        subtotal: qty * price
      });
    });
    setParsedBelanja(parsed);
    setBelanjaErrors(errs);
  }, [belanjaText]);

  const submitBelanja = async () => {
    if (parsedBelanja.length === 0 || saving) return;
    setSaving(true);
    try {
      const items = parsedBelanja.map(p => ({
        nama_item: p.name,
        qty: p.qty,
        satuan: p.unit,
        harga_satuan: p.price,
        subtotal: p.subtotal
      }));

      await apiPost("/transactions/manual", {
        supplier_name: "Input Manual Web",
        date: new Date().toISOString().split('T')[0],
        payment_method: paymentMethod,
        due_date: paymentMethod === "hutang" ? dueDate : null,
        items: items
      });

      setBelanjaText("");
      setParsedBelanja([]);
      setPaymentMethod("tunai");
      setDueDate(defaultDueDate);
      alert("✅ Belanja berhasil disimpan! Stok bertambah dan bahan baru telah dibuat otomatis.");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Gagal menyimpan belanja");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 border-l-4 border-blue-500 pl-3">🛒 Input Belanja Manual</h2>
        <p className="text-gray-500 text-sm mt-2 ml-4">
          Jika tidak memakai Telegram, masukkan daftar dari nota di sini.<br />
          Sistem akan otomatis mendaftarkan master bahannya jika belum ada.
          <br /><br />
          Format penulisan yang benar: <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-xs">Nama Item [spasi] Qty [spasi] Satuan [spasi] Harga Satuan</span>
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-3">
          <label className="text-sm font-semibold text-gray-700">Daftar Belanja</label>
          <textarea
            value={belanjaText}
            onChange={e => setBelanjaText(e.target.value)}
            placeholder="Contoh:&#10;Beras Ramos 50 kg 12000&#10;Telur Ayam 30 pcs 2000&#10;Minyak Goreng 2 liter 18000"
            className="w-full h-64 p-4 border border-gray-200 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none leading-relaxed transition-shadow"
          />
          {belanjaErrors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg font-medium">
              <span>⚠️</span> {err}
            </div>
          ))}

          {/* Payment Method Selector */}
          <div className="mt-2 p-5 bg-gray-50/50 border border-gray-100 rounded-2xl shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Pilih Pembayaran</label>
            <select 
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 font-medium outline-none transition-shadow"
            >
              <option value="tunai">Cash (Tunai)</option>
              <option value="transfer">Transfer Bank</option>
              <option value="hutang">Hutang (Tempo)</option>
            </select>
            
            {paymentMethod === "hutang" && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Jatuh Tempo</label>
                <input 
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-red-500 outline-none shadow-sm"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_2px_20px_-8px_rgba(0,0,0,0.1)] border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="text-xl">🧾</span> Preview Tagihan
            </h4>
          </div>
          
          {parsedBelanja.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm py-12">
              <span className="text-4xl opacity-30 mb-3 grayscale">📝</span>
              <p>Belum ada item valid.</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 p-5">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-500">
                    <th className="pb-3 font-semibold">Item & Qty</th>
                    <th className="pb-3 font-semibold text-right">Harga</th>
                    <th className="pb-3 font-semibold text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedBelanja.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 pr-2">
                        <div className="font-bold text-gray-900">{p.name}</div>
                        <div className="text-xs font-medium text-gray-500 bg-gray-100 inline-block px-1.5 py-0.5 rounded mt-1">{p.qty} {p.unit}</div>
                      </td>
                      <td className="py-3 text-right text-gray-600 font-medium"><Rupiah amount={p.price} /></td>
                      <td className="py-3 text-right font-bold text-gray-900"><Rupiah amount={p.subtotal} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50/30">
                    <td colSpan={2} className="pt-4 pb-3 px-3 font-black text-right text-gray-800 rounded-l-lg border-t border-blue-100">TOTAL KESELURUHAN</td>
                    <td className="pt-4 pb-3 pr-3 font-black text-right text-blue-700 text-lg rounded-r-lg border-t border-blue-100">
                      <Rupiah amount={parsedBelanja.reduce((sum, p) => sum + p.subtotal, 0)} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          
          <div className="p-5 bg-gray-50/50 border-t border-gray-100">
            <button
              disabled={parsedBelanja.length === 0 || saving}
              onClick={submitBelanja}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:grayscale font-bold shadow-md shadow-blue-500/20 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  Memproses...
                </>
              ) : (
                <>✅ Simpan {parsedBelanja.length} Item ke Master Stok</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
