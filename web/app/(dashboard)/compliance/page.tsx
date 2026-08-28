"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPatch } from "@/lib/api";

/* ─── Types ─────────────────────────────────────────────────────────────── */
type Tab = "hygiene" | "temperature" | "samples" | "waste" | "incidents" | "slhs";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "hygiene", label: "Higiene", icon: "🧹" },
  { key: "temperature", label: "Suhu", icon: "🌡️" },
  { key: "samples", label: "Bank Sampel", icon: "🧪" },
  { key: "waste", label: "Sisa Makanan", icon: "🍽️" },
  { key: "incidents", label: "Insiden", icon: "🚨" },
  { key: "slhs", label: "SLHS", icon: "📜" },
];

const HYGIENE_AREAS = [
  "Kebersihan Lantai & Dinding",
  "Suhu Penyimpanan (Chiller/Freezer)",
  "Kebersihan Peralatan Masak",
  "Atribut Personel (Masker/Apron/Hairnet)",
  "Kualitas Air Bersih",
  "Kebersihan Area Penyimpanan",
  "Kondisi Tempat Sampah",
];

const TEMP_AREAS = ["gudang_kering", "chiller", "freezer"] as const;
const TEMP_LIMITS: Record<string, { min: number; max: number }> = {
  gudang_kering: { min: 0, max: 25 },
  chiller: { min: 0, max: 5 },
  freezer: { min: -30, max: -18 },
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const today = () => new Date().toISOString().split("T")[0];
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; }
};

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>("hygiene");
  const [alertCounts, setAlertCounts] = useState({ temp: 0, sample: 0, incident: 0 });

  // Fetch global alert counts
  useEffect(() => {
    const now = new Date();
    Promise.allSettled([
      apiGet("/compliance/temperature", { log_date: today() }),
      apiGet("/compliance/food-samples"),
      apiGet("/compliance/incidents", { month: now.getMonth() + 1, year: now.getFullYear() }),
    ]).then(([tempR, smpR, incR]) => {
      setAlertCounts({
        temp: tempR.status === "fulfilled" ? (tempR.value?.anomalies ?? 0) : 0,
        sample: smpR.status === "fulfilled" ? (smpR.value?.alerts_count ?? 0) : 0,
        incident: incR.status === "fulfilled" ? (incR.value?.data?.filter((i: any) => i.status === "investigasi")?.length ?? 0) : 0,
      });
    });
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-in mt-2">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="pt-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
          Operasional & Compliance
        </h1>
        <p className="text-gray-500 font-medium text-sm mt-1">Pantau standar higienitas dan mutu program MBG harian.</p>
      </div>

      {/* Alert banner */}
      {(alertCounts.temp + alertCounts.incident) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm space-y-1">
          {alertCounts.temp > 0 && <p className="text-red-800">⚠️ {alertCounts.temp} anomali suhu terdeteksi hari ini</p>}
          {alertCounts.incident > 0 && <p className="text-red-900">🚨 {alertCounts.incident} insiden dalam investigasi</p>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-white/70 backdrop-blur-xl rounded-2xl p-2 overflow-x-auto flex-nowrap no-scrollbar border border-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative z-10">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
              tab === t.key ? "bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <span className={`text-base ${tab === t.key ? '' : 'grayscale opacity-75'}`}>{t.icon}</span>
            <span className="hidden sm:inline tracking-tight">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "hygiene" && <HygieneTab />}
      {tab === "temperature" && <TemperatureTab />}
      {tab === "samples" && <SamplesTab />}
      {tab === "waste" && <WasteTab />}
      {tab === "incidents" && <IncidentsTab />}
      {tab === "slhs" && <SLHSTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 1: Hygiene
   ═══════════════════════════════════════════════════════════════════════════ */
function HygieneTab() {
  const [checks, setChecks] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState(HYGIENE_AREAS.map((a) => ({ area: a, status: "baik", catatan: "" })));
  const [checkDate, setCheckDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const now = new Date();
    apiGet("/compliance/hygiene", { month: now.getMonth() + 1, year: now.getFullYear() })
      .then((d) => setChecks(d.data || []))
      .catch(() => {});
  }, []);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await apiPost("/compliance/hygiene", { check_date: checkDate, items, notes });
      setChecks([res.data, ...checks]);
      setShowForm(false);
      setItems(HYGIENE_AREAS.map((a) => ({ area: a, status: "baik", catatan: "" })));
      setNotes("");
    } catch { }
    setLoading(false);
  };

  const statusBadge = (s: string) => {
    if (s === "baik") return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">✓ Baik</span>;
    if (s === "perlu_perbaikan") return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">⚠️ Perlu Perbaikan</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">✗ Tidak Layak</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Checklist Higiene</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? "Batal" : "+ Checklist Baru"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Tanggal</label>
            <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" />
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="p-3 bg-gray-50 rounded-lg space-y-2">
              <p className="text-sm font-medium">{item.area}</p>
              <select
                value={item.status}
                onChange={(e) => { const n = [...items]; n[idx].status = e.target.value; setItems(n); }}
                className="w-full border rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="baik">✓ Baik</option>
                <option value="perlu_perbaikan">⚠️ Perlu Perbaikan</option>
              </select>
              <input placeholder="Catatan (opsional)" value={item.catatan}
                onChange={(e) => { const n = [...items]; n[idx].catatan = e.target.value; setItems(n); }}
                className="w-full border rounded-lg px-3 py-1.5 text-sm" />
            </div>
          ))}
          <input placeholder="Catatan umum" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <button onClick={submit} disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Menyimpan..." : "Simpan Checklist"}
          </button>
        </div>
      )}

      {checks.map((c) => (
        <div key={c.id} className="bg-white/80 backdrop-blur-xl border border-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-2xl p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-semibold">{fmtDate(c.check_date)}</p>
            </div>
            {statusBadge(c.overall_status)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(c.items || []).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                <span>{item.status === "baik" ? "✅" : "⚠️"}</span>
                <span className="truncate">{item.area}</span>
              </div>
            ))}
          </div>
          {c.notes && <p className="mt-2 text-sm text-gray-600 bg-blue-50 p-2 rounded">📝 {c.notes}</p>}
        </div>
      ))}
      {checks.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada checklist bulan ini</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 2: Temperature
   ═══════════════════════════════════════════════════════════════════════════ */
function TemperatureTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ log_date: today(), log_time: "08:00", area: "chiller", temperature: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet("/compliance/temperature", { log_date: today() })
      .then((d) => setLogs(d.data || []))
      .catch(() => {});
  }, []);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await apiPost("/compliance/temperature", { ...form, temperature: parseFloat(form.temperature) });
      setLogs([res.data, ...logs]);
      setShowForm(false);
      setForm({ log_date: today(), log_time: "08:00", area: "chiller", temperature: "" });
    } catch { }
    setLoading(false);
  };

  const anomalies = logs.filter((l) => !l.is_normal);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Monitoring Suhu</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? "Batal" : "+ Catat Suhu"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Tanggal</label><input type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-sm font-medium">Jam</label><input type="time" value={form.log_time} onChange={(e) => setForm({ ...form, log_time: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div><label className="text-sm font-medium">Area</label>
            <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm">
              {TEMP_AREAS.map((a) => <option key={a} value={a}>{a} ({TEMP_LIMITS[a].min}~{TEMP_LIMITS[a].max}°C)</option>)}
            </select>
          </div>
          <div><label className="text-sm font-medium">Suhu (°C)</label><input type="number" step="0.1" placeholder="Contoh: 3.5" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
          <button onClick={submit} disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      )}

      {anomalies.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <h3 className="font-semibold text-red-900 mb-1">⚠️ Anomali Suhu</h3>
          <ul className="text-sm text-red-800 space-y-0.5">
            {anomalies.map((a, i) => <li key={i}>{a.area}: {a.temperature}°C pada {a.log_time}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-white/90 backdrop-blur-xl border border-white shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] rounded-2xl overflow-hidden mt-2">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>
            <th className="text-left px-4 py-2.5">Jam</th><th className="text-left px-4 py-2.5">Area</th>
            <th className="text-right px-4 py-2.5">Suhu (°C)</th><th className="text-center px-4 py-2.5">Status</th>
          </tr></thead>
          <tbody>{logs.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="px-4 py-2">{l.log_time}</td>
              <td className="px-4 py-2">{l.area}</td>
              <td className="text-right px-4 py-2 font-mono">{l.temperature}</td>
              <td className="text-center px-4 py-2">{l.is_normal ? <span className="text-green-600">✓</span> : <span className="text-red-600">⚠️</span>}</td>
            </tr>
          ))}</tbody>
        </table>
        {logs.length === 0 && <p className="text-center text-gray-400 py-6">Belum ada log suhu hari ini</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 3: Food Samples
   ═══════════════════════════════════════════════════════════════════════════ */
function SamplesTab() {
  const [samples, setSamples] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ sample_date: today(), menu_name: "", taken_at: "08:00", weight_gram: 50, storage_temp: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet("/compliance/food-samples")
      .then((d) => { setSamples(d.data || []); setAlerts(d.alerts || []); })
      .catch(() => {});
  }, []);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await apiPost("/compliance/food-samples", {
        ...form, weight_gram: parseFloat(String(form.weight_gram)),
        storage_temp: form.storage_temp ? parseFloat(form.storage_temp) : null
      });
      setSamples([res.data, ...samples]);
      setShowForm(false);
    } catch { }
    setLoading(false);
  };

  const dispose = async (id: string) => {
    try {
      await apiPatch(`/compliance/food-samples/${id}/dispose`, { reason: "normal_disposal" });
      setSamples(samples.map((s) => s.id === id ? { ...s, status: "dibuang" } : s));
    } catch { }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Bank Sampel Makanan</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
          {showForm ? "Batal" : "+ Ambil Sampel"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Tanggal</label><input type="date" value={form.sample_date} onChange={(e) => setForm({ ...form, sample_date: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-sm font-medium">Jam Ambil</label><input type="time" value={form.taken_at} onChange={(e) => setForm({ ...form, taken_at: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div><label className="text-sm font-medium">Menu</label><input placeholder="Nasi Goreng" value={form.menu_name} onChange={(e) => setForm({ ...form, menu_name: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Berat (g)</label><input type="number" value={form.weight_gram} onChange={(e) => setForm({ ...form, weight_gram: parseFloat(e.target.value) })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-sm font-medium">Suhu (°C, opsional)</label><input type="number" step="0.1" value={form.storage_temp} onChange={(e) => setForm({ ...form, storage_temp: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <button onClick={submit} disabled={loading} className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {loading ? "Menyimpan..." : "Simpan Sampel"}
          </button>
        </div>
      )}


      <div className="grid gap-3">
        {samples.map((s) => (
          <div key={s.id} className={`bg-white/80 backdrop-blur-xl border border-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-2xl p-5 ${s.status === "dibuang" ? "opacity-50" : ""}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{s.sample_code}</p>
                <p className="text-sm text-gray-600">{s.menu_name}</p>
                <p className="text-xs text-gray-400 mt-1">Diambil: {fmtDate(s.sample_date)} {s.taken_at}</p>
              </div>
              <div className="text-right">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  s.hours_remaining && s.hours_remaining > 4 ? "bg-green-100 text-green-800"
                  : s.hours_remaining && s.hours_remaining > 0 ? "bg-orange-100 text-orange-800"
                  : "bg-red-100 text-red-800"
                }`}>
                  {s.hours_remaining ? (s.hours_remaining > 0 ? `⏱️ ${s.hours_remaining.toFixed(1)}h` : "❌ Expired") : s.status}
                </span>
                {s.status === "disimpan" && (
                  <button onClick={() => dispose(s.id)} className="mt-2 block text-xs text-red-600 hover:underline">🗑️ Buang</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {samples.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada sampel</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 4: Food Waste
   ═══════════════════════════════════════════════════════════════════════════ */
function WasteTab() {
  const [reports, setReports] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [targetDate, setTargetDate] = useState(today());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
  const [form, setForm] = useState({ portions_consumed: "", comstock_score: 3, waste_reason: "" });
  const [loading, setLoading] = useState(false);

  // Fetch riwayat bulanan
  useEffect(() => {
    apiGet("/compliance/food-waste", { month, year })
      .then((d) => setReports(d.data || []))
      .catch(() => {});
  }, [month, year]);

  // Fetch target sekolah per hari
  useEffect(() => {
    apiGet("/compliance/food-waste-targets", { target_date: targetDate })
      .then((d) => setTargets(d.data || []))
      .catch(() => {});
  }, [targetDate]);

  const submit = async (target: any) => {
    setLoading(true);
    try {
      const res = await apiPost("/compliance/food-waste", {
        school_id: target.school_id,
        report_date: targetDate,
        portions_sent: target.portions_sent,
        portions_consumed: parseInt(form.portions_consumed),
        comstock_score: form.comstock_score,
        waste_reason: form.waste_reason,
      });
      // Update local targets state
      setTargets(targets.map(t => t.school_id === target.school_id ? { ...t, is_reported: true, report_id: res.data.id } : t));
      // Add to reports history with injected school name
      setReports([{ ...res.data, schools: { name: target.school_name } }, ...reports]);
      setActiveSchoolId(null);
      setForm({ portions_consumed: "", comstock_score: 3, waste_reason: "" });
    } catch (e: any) { 
      alert(e.response?.data?.detail || "Gagal menyimpan laporan.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      
      {/* SECTION: Input Laporan Harian */}
      <div className="bg-white/80 backdrop-blur-xl border border-white shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-lg font-bold">Input Laporan Sisa Makanan</h2>
            <p className="text-sm text-gray-500">Pilih sekolah untuk melaporkan sisa (Comstock).</p>
          </div>
          <input 
            type="date" 
            value={targetDate} 
            onChange={(e) => setTargetDate(e.target.value)} 
            className="border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {targets.map(t => (
            <div key={t.school_id} className={`border rounded-xl p-4 flex flex-col ${t.is_reported ? "bg-green-50 border-green-200" : "bg-white"}`}>
              <div className="mb-2">
                <h3 className="font-bold text-gray-900 truncate">{t.school_name}</h3>
                <p className="text-sm text-gray-600 line-clamp-1">{t.menu_name || "Tidak ada menu"}</p>
                <div className="text-xs text-gray-500 mt-1">Target Kirim: <span className="font-semibold text-gray-700">{t.portions_sent} porsi</span></div>
              </div>
              
              <div className="mt-auto pt-3">
                {t.is_reported ? (
                  <div className="text-sm font-medium text-green-700 flex items-center gap-1.5"><span className="text-lg">✅</span> Sudah Dilaporkan</div>
                ) : activeSchoolId === t.school_id ? (
                  <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1 block">Porsi Dikonsumsi</label>
                      <input type="number" placeholder="Contoh: 90" value={form.portions_consumed} onChange={(e) => setForm({ ...form, portions_consumed: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1 block">Skor Comstock</label>
                      <select 
                        value={form.comstock_score} 
                        onChange={(e) => {
                          const score = +e.target.value;
                          let sisa_pct = 0;
                          if (score === 1) sisa_pct = 0;
                          else if (score === 2) sisa_pct = 0.125;
                          else if (score === 3) sisa_pct = 0.375;
                          else if (score === 4) sisa_pct = 0.625;
                          else if (score === 5) sisa_pct = 0.875;
                          const consumed = Math.round(t.portions_sent * (1 - sisa_pct));
                          setForm({ ...form, comstock_score: score, portions_consumed: consumed.toString() });
                        }} 
                        className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                      >
                        <option value={1}>1 ⭐ Habis (0%)</option>
                        <option value={2}>2 ⭐ Sisa &lt;25%</option>
                        <option value={3}>3 ⭐ Sisa 25-50%</option>
                        <option value={4}>4 ⭐ Sisa 50-75%</option>
                        <option value={5}>5 ⭐ Sisa &gt;75%</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1 block">Alasan Sisa (opsional)</label>
                      <input placeholder="Kenyang, kurang suka..." value={form.waste_reason} onChange={(e) => setForm({ ...form, waste_reason: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setActiveSchoolId(null)} className="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300">Batal</button>
                      <button onClick={() => submit(t)} disabled={loading} className="flex-1 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">Kirim</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setActiveSchoolId(t.school_id); setForm({ portions_consumed: t.portions_sent.toString(), comstock_score: 1, waste_reason: "" }); }} className="w-full py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors">
                    📝 Laporkan Sisa
                  </button>
                )}
              </div>
            </div>
          ))}
          {targets.length === 0 && (
            <div className="col-span-full py-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              Tidak ada data pengiriman (buku harian/delivery) untuk tanggal ini.<br/>
              Pastikan pengiriman sudah diinput di modul Operasional &gt; Pengiriman.
            </div>
          )}
        </div>
      </div>

      {/* SECTION: History Laporan */}
      <div className="flex justify-between items-center px-1">
        <h2 className="text-lg font-bold">Riwayat Laporan (Bulanan)</h2>
        <div className="flex gap-2 items-center">
          <select value={month} onChange={(e) => setMonth(+e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleDateString("id-ID", { month: "long" })}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(+e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
            <option value={2025}>2025</option><option value={2026}>2026</option>
          </select>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-xl border border-white shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] rounded-2xl overflow-hidden mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tanggal</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Sekolah</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Kirim</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Konsumsi</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Sisa (Porsi)</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">% Sisa</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Comstock</th>
            </tr></thead>
            <tbody>{reports.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(r.report_date)}</td>
                <td className="px-4 py-2.5 text-gray-900">{r.schools?.name || r.school_id}</td>
                <td className="text-right px-4 py-2.5">{r.portions_sent}</td>
                <td className="text-right px-4 py-2.5 font-medium">{r.portions_consumed}</td>
                <td className="text-right px-4 py-2.5 text-orange-700 font-semibold">
                  {Math.max(0, r.portions_sent - r.portions_consumed)}
                </td>
                <td className="text-right px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.waste_pct > 20 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {r.waste_pct}%
                  </span>
                </td>
                <td className="text-center px-4 py-2.5"><span className="text-lg" title={`Skor ${r.comstock_score}`}>{"⭐".repeat(r.comstock_score)}</span></td>
              </tr>
            ))}</tbody>
          </table>
          {reports.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada riwayat laporan bulan ini</p>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 5: Incidents
   ═══════════════════════════════════════════════════════════════════════════ */
function IncidentsTab() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ school_id: "", incident_time: new Date().toISOString().substring(0, 16), location: "", victim_count: "", symptoms: [""], first_action: "", sample_secured: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const now = new Date();
    apiGet("/compliance/incidents", { month: now.getMonth() + 1, year: now.getFullYear() })
      .then((d) => setIncidents(d.data || []))
      .catch(() => {});
  }, []);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await apiPost("/compliance/incidents", {
        ...form,
        victim_count: parseInt(form.victim_count),
        symptoms: form.symptoms.filter(Boolean),
      });
      setIncidents([res.data, ...incidents]);
      setShowForm(false);
    } catch { }
    setLoading(false);
  };

  const pending = incidents.filter((i) => i.status === "investigasi").length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Laporan Insiden</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
          {showForm ? "Batal" : "+ Laporkan Insiden"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <input placeholder="ID Sekolah (opsional)" value={form.school_id} onChange={(e) => setForm({ ...form, school_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Waktu</label><input type="datetime-local" value={form.incident_time} onChange={(e) => setForm({ ...form, incident_time: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-sm font-medium">Jumlah Korban</label><input type="number" value={form.victim_count} onChange={(e) => setForm({ ...form, victim_count: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <input placeholder="Lokasi" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div>
            <label className="text-sm font-medium">Gejala</label>
            {form.symptoms.map((s, idx) => (
              <input key={idx} placeholder="mual, muntah, diare" value={s}
                onChange={(e) => { const n = [...form.symptoms]; n[idx] = e.target.value; setForm({ ...form, symptoms: n }); }}
                className="w-full mt-1 border rounded-lg px-3 py-1.5 text-sm" />
            ))}
            <button onClick={() => setForm({ ...form, symptoms: [...form.symptoms, ""] })} className="text-xs text-blue-600 mt-1">+ Tambah gejala</button>
          </div>
          <input placeholder="Tindakan pertama" value={form.first_action} onChange={(e) => setForm({ ...form, first_action: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.sample_secured} onChange={(e) => setForm({ ...form, sample_secured: e.target.checked })} />
            Sampel makanan diamankan
          </label>
          <button onClick={submit} disabled={loading} className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {loading ? "Mengirim..." : "Kirim Laporan"}
          </button>
        </div>
      )}

      {pending > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="font-semibold text-red-900">🚨 {pending} insiden dalam investigasi</p>
        </div>
      )}

      {incidents.map((inc) => (
        <div key={inc.id} className={`bg-white/80 backdrop-blur-xl border border-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-2xl p-5 ${inc.status === "investigasi" ? "border-red-200 bg-red-50/50" : ""}`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold">{inc.incident_code}</p>
              <p className="text-sm text-gray-600">{fmtDate((inc.incident_time || "").substring(0, 10))}</p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              inc.status === "investigasi" ? "bg-red-200 text-red-900"
              : inc.status === "selesai" ? "bg-green-200 text-green-900" : "bg-gray-200 text-gray-700"
            }`}>{inc.status}</span>
          </div>
          <div className="text-sm space-y-1">
            <p><strong>Lokasi:</strong> {inc.location}</p>
            <p><strong>Korban:</strong> {inc.victim_count} orang</p>
            <p><strong>Gejala:</strong> {(inc.symptoms || []).join(", ") || "—"}</p>
            <p><strong>Sampel:</strong> {inc.sample_secured ? "✓ Diamankan" : "✗ Tidak"}</p>
          </div>
        </div>
      ))}
      {incidents.length === 0 && <p className="text-center text-gray-400 py-8">Tidak ada insiden</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 6: SLHS
   ═══════════════════════════════════════════════════════════════════════════ */
function SLHSTab() {
  const [docs, setDocs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ cert_number: "", issued_date: "", expires_date: "", label_expires: "", file_url: "", notes: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet("/compliance/slhs").then((d) => setDocs(d.data || [])).catch(() => {});
  }, []);

  const submit = async () => {
    setLoading(true);
    try {
      const body: any = { cert_number: form.cert_number, issued_date: form.issued_date, expires_date: form.expires_date };
      if (form.label_expires) body.label_expires = form.label_expires;
      if (form.file_url) body.file_url = form.file_url;
      if (form.notes) body.notes = form.notes;
      const res = await apiPost("/compliance/slhs", body);
      setDocs([res.data, ...docs]);
      setShowForm(false);
    } catch { }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Dokumen SLHS</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
          {showForm ? "Batal" : "+ Sertifikat Baru"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <input placeholder="Nomor Sertifikat" value={form.cert_number} onChange={(e) => setForm({ ...form, cert_number: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Tanggal Terbit</label><input type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-sm font-medium">Kadaluarsa</label><input type="date" value={form.expires_date} onChange={(e) => setForm({ ...form, expires_date: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div><label className="text-sm font-medium">Label Habis (opsional)</label><input type="date" value={form.label_expires} onChange={(e) => setForm({ ...form, label_expires: e.target.value })} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" /></div>
          <input placeholder="URL Dokumen (opsional)" value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Catatan (opsional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <button onClick={submit} disabled={loading} className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
            {loading ? "Menyimpan..." : "Simpan SLHS"}
          </button>
        </div>
      )}

      {docs.map((s) => {
        const daysLeft = s.days_until_expiry ?? Math.ceil((new Date(s.expires_date).getTime() - Date.now()) / 86400000);
        const isExpiring = daysLeft <= 90;
        return (
          <div key={s.id} className={`bg-white/80 backdrop-blur-xl border border-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-2xl p-5 ${isExpiring ? "border-yellow-300 bg-yellow-50" : ""}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{s.cert_number}</p>
                <p className="text-sm text-gray-600">Terbit: {fmtDate(s.issued_date)}</p>
                <p className="text-sm text-gray-600">Kadaluarsa: {fmtDate(s.expires_date)}</p>
              </div>
              <div className="text-right">
                <span className={`text-sm font-semibold ${daysLeft <= 30 ? "text-red-600" : daysLeft <= 90 ? "text-yellow-600" : "text-green-600"}`}>
                  {daysLeft > 0 ? `${daysLeft} hari` : "Kadaluarsa"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {docs.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada dokumen SLHS</p>}
    </div>
  );
}
