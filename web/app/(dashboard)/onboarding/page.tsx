"use client";

import { apiGet, apiPost, apiPut } from "@/lib/api";
import { useEffect, useState } from "react";

interface OnboardingStep {
  number: 1 | 2 | 3 | 4 | 5;
  title: string;
}

const STEPS: OnboardingStep[] = [
  { number: 1, title: "Identitas SPPG" },
  { number: 2, title: "Daftar Sekolah" },
  { number: 3, title: "Daftar Supplier" },
  { number: 4, title: "Bahan Baku" },
  { number: 5, title: "Resep / BOM" },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiGet("/tenants/me");
        if (result.success) {
          setTenant(result.data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, []);

  const handleNext = async () => {
    if (currentStep < 5) {
      // Simpan step saat ini jika ada perubahan
      setCurrentStep((currentStep + 1) as 1 | 2 | 3 | 4 | 5);
    } else {
      // Selesai onboarding
      window.location.href = "/pembukuan";
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3 | 4 | 5);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Onboarding Setup</h1>

      {/* Stepper */}
      <div className="flex justify-between mb-12">
        {STEPS.map((step) => (
          <div
            key={step.number}
            className={`flex flex-col items-center ${step.number <= currentStep ? "opacity-100" : "opacity-50"
              }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step.number === currentStep
                  ? "bg-blue-600 text-white"
                  : step.number < currentStep
                    ? "bg-green-600 text-white"
                    : "bg-gray-300"
                }`}
            >
              {step.number < currentStep ? "✓" : step.number}
            </div>
            <p className="text-sm mt-2 text-center">{step.title}</p>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white p-8 rounded-lg shadow mb-8">
        {currentStep === 1 && (
          <Step1Identitas tenant={tenant} onUpdate={setTenant} />
        )}
        {currentStep === 2 && <Step2Sekolah />}
        {currentStep === 3 && <Step3Supplier />}
        {currentStep === 4 && <Step4Bahan />}
        {currentStep === 5 && <Step5Resep />}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handlePrev}
          disabled={currentStep === 1}
          className="px-6 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
        >
          ← Sebelumnya
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {currentStep === 5 ? "✅ Selesai Setup" : "Simpan & Lanjut →"}
        </button>
      </div>
    </div>
  );
}

function Step1Identitas({
  tenant,
  onUpdate,
}: {
  tenant: any;
  onUpdate: (t: any) => void;
}) {
  const [data, setData] = useState(tenant || {});
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const result = await apiPut("/tenants/me", data);
      if (result.success) {
        onUpdate(result.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Identitas SPPG</h2>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Nama SPPG"
          value={data.name || ""}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          className="w-full px-4 py-2 border rounded"
        />
        <input
          type="text"
          placeholder="Kode SPPG"
          value={data.sppg_code || ""}
          onChange={(e) => setData({ ...data, sppg_code: e.target.value })}
          className="w-full px-4 py-2 border rounded"
        />
        <input
          type="text"
          placeholder="Alamat"
          value={data.address || ""}
          onChange={(e) => setData({ ...data, address: e.target.value })}
          className="w-full px-4 py-2 border rounded"
        />
        <input
          type="text"
          placeholder="Nama Penanggung Jawab"
          value={data.contact_name || ""}
          onChange={(e) => setData({ ...data, contact_name: e.target.value })}
          className="w-full px-4 py-2 border rounded"
        />
        <input
          type="tel"
          placeholder="Telepon"
          value={data.phone || ""}
          onChange={(e) => setData({ ...data, phone: e.target.value })}
          className="w-full px-4 py-2 border rounded"
        />
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}

function Step2Sekolah() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Daftar Sekolah</h2>
      <p className="text-gray-600 mb-4">
        ℹ️ Sekolah bisa ditambah kapan saja dari Settings
      </p>
      <p>Fitur lengkap akan disediakan di halaman Settings.</p>
    </div>
  );
}

function Step3Supplier() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Daftar Supplier</h2>
      <p className="text-gray-600 mb-4">
        ℹ️ Supplier bisa ditambah kapan saja dari Settings
      </p>
      <p>Fitur lengkap akan disediakan di halaman Settings.</p>
    </div>
  );
}

function Step4Bahan() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Bahan Baku</h2>
      <p className="text-yellow-600 mb-4">
        ⚠️ Isi stok sesuai fisik hari ini. Ini jadi titik awal —
        sistem update otomatis setelahnya.
      </p>
      <p>Fitur lengkap akan disediakan di halaman Settings.</p>
    </div>
  );
}

function Step5Resep() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Resep / BOM</h2>
      <p className="text-blue-600 mb-4">
        💡 Tidak perlu lengkap sekarang. Sistem akan minta BOM
        otomatis saat ada menu baru.
      </p>
      <p>Fitur lengkap akan disediakan di halaman Settings.</p>
    </div>
  );
}
