import io
from datetime import date, datetime
from decimal import Decimal
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from services.kas_service import KasService

BULAN_ROMAWI = {
    1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI",
    7: "VII", 8: "VIII", 9: "IX", 10: "X", 11: "XI", 12: "XII"
}
BULAN_NAMA = {
    1: "Januari", 2: "Februari", 3: "Maret", 4: "April",
    5: "Mei", 6: "Juni", 7: "Juli", 8: "Agustus",
    9: "September", 10: "Oktober", 11: "November", 12: "Desember"
}

def _d(v):
    return Decimal(str(v or 0))

def _rp(val):
    if val is None:
        val = 0
    return f"Rp {int(val):,}".replace(",", ".")

class SPTService:
    @staticmethod
    def _get_tenant(tenant_id: str, supabase):
        res = supabase.table("tenants").select("*").eq("id", tenant_id).execute()
        return res.data[0] if getattr(res, "data", None) else {}

    @staticmethod
    def _upload_to_storage(supabase, tenant_id: str, filename: str, pdf_bytes: bytes) -> str:
        path = f"{tenant_id}/dokumen/{filename}"
        bucket = "nota-photos"
        import os
        from supabase import Client
        try:
            supabase.storage.from_(bucket).upload(
                path=path,
                file=pdf_bytes,
                file_options={"content-type": "application/pdf"}
            )
        except Exception as e:
            if "Duplicate" in str(e) or "already exists" in str(e).lower() or "400" in str(e):
                supabase.storage.from_(bucket).update(
                    path=path,
                    file=pdf_bytes,
                    file_options={"content-type": "application/pdf"}
                )
            else:
                raise e
        return supabase.storage.from_(bucket).get_public_url(path)

    @staticmethod
    def generate_spt(tenant_id: str, year: int, month: int, supabase) -> str:
        """Generate PDF SPT dan upload, return file URL."""
        tenant = SPTService._get_tenant(tenant_id, supabase)
        slug = tenant.get("slug") or "sppg"
        owner_name = tenant.get("owner_name") or "-"
        address = tenant.get("address") or "-"
        phone = tenant.get("phone") or "-"
        nik = tenant.get("owner_nik") or tenant.get("nik") or "-"
        name = tenant.get("name") or "SPPG"
        city = tenant.get("city") or "Kota"
        
        # Hitung data summary
        first = date(year, month, 1)
        if month == 12:
            import datetime
            last = date(year + 1, 1, 1) - datetime.timedelta(days=1)
        else:
            import datetime
            last = date(year, month + 1, 1) - datetime.timedelta(days=1)
        
        # Deliveries -> total porsi, jumlah sekolah
        del_resp = supabase.table("mbg_deliveries").select("portions_sent, school_id").eq("tenant_id", tenant_id).gte("delivery_date", first.isoformat()).lte("delivery_date", last.isoformat()).execute()
        deliveries = getattr(del_resp, "data", None) or []
        total_porsi = sum(d.get("portions_sent", 0) for d in deliveries)
        jumlah_sekolah = len({d.get("school_id") for d in deliveries if d.get("school_id")})
        
        # Price
        alloc_resp = supabase.table("mbg_allocation_settings").select("price_per_portion").eq("tenant_id", tenant_id).limit(1).execute()
        alloc = (getattr(alloc_resp, "data", None) or [{}])[0]
        price_pp = _d(alloc.get("price_per_portion", 15000))
        pencairan = price_pp * _d(total_porsi)
        
        # Biaya
        trx_resp = supabase.table("transactions").select("total, juknis_category").eq("tenant_id", tenant_id).eq("status", "confirmed").gte("date", first.isoformat()).lte("date", last.isoformat()).execute()
        transactions = getattr(trx_resp, "data", None) or []
        
        exp_bahan = sum(_d(t.get("total")) for t in transactions if str(t.get("juknis_category")).lower() not in ("insentif", "operasional"))
        exp_upah = sum(_d(t.get("total")) for t in transactions if str(t.get("juknis_category")).lower() == "insentif")
        exp_ops = sum(_d(t.get("total")) for t in transactions if str(t.get("juknis_category")).lower() == "operasional")
        total_exp = exp_bahan + exp_upah + exp_ops
        
        target_bahan = pencairan * Decimal("0.80")
        target_upah = pencairan * Decimal("0.15")
        target_ops = pencairan * Decimal("0.05")
        
        def pct(aktual, target):
            return f"{round(float(aktual/target*100), 1)}%" if target > 0 else "0%"
            
        sisa_dana = pencairan - total_exp
        
        # Cek pengembalian (return_to_gov) 
        # Atau bisa cari return record di fund_returns (jika ada) - kita pakai logic cari di tabel kas_ledger type return_to_gov
        return_resp = supabase.table("kas_ledger").select("*").eq("tenant_id", tenant_id).eq("entry_type", "credit").eq("reference_type", "return_to_gov").gte("entry_date", first.isoformat()).lte("entry_date", last.isoformat()).execute()
        returns = getattr(return_resp, "data", None) or []
        return_date = returns[0]["entry_date"] if returns else "-"
        return_ref = returns[0]["description"].split("(Ref: ")[-1].replace(")", "") if returns and "(Ref: " in returns[0].get("description", "") else "-"

        # Draw PDF
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(A4[0]/2, A4[1] - 2*cm, name.upper())
        c.setFont("Helvetica", 10)
        c.drawCentredString(A4[0]/2, A4[1] - 2.5*cm, address)
        c.drawCentredString(A4[0]/2, A4[1] - 3*cm, f"Telp: {phone}")
        c.line(2*cm, A4[1] - 3.5*cm, A4[0]-2*cm, A4[1] - 3.5*cm)
        
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(A4[0]/2, A4[1] - 4.5*cm, "SURAT PERNYATAAN TANGGUNG JAWAB")
        no_spt = f"SPT-{BULAN_ROMAWI[month]}/{year}/{slug}"
        c.setFont("Helvetica", 11)
        c.drawCentredString(A4[0]/2, A4[1] - 5*cm, f"Nomor: {no_spt}")
        
        text_y = A4[1] - 6.5*cm
        c.drawString(2*cm, text_y, "Yang bertanda tangan di bawah ini:")
        text_y -= 0.6*cm
        c.drawString(2.5*cm, text_y, f"Nama      : {owner_name}")
        text_y -= 0.6*cm
        c.drawString(2.5*cm, text_y, f"Jabatan   : Penanggungjawab SPPG")
        text_y -= 0.6*cm
        c.drawString(2.5*cm, text_y, f"Alamat    : {address}")
        
        text_y -= 1*cm
        c.drawString(2*cm, text_y, f"Menyatakan bahwa dana program MBG periode {BULAN_NAMA[month]} {year}")
        text_y -= 0.5*cm
        c.drawString(2*cm, text_y, f"sebesar {_rp(pencairan)} telah digunakan sebagai berikut:")
        
        # Tabel
        text_y -= 1*cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2*cm, text_y, "Komponen")
        c.drawString(7*cm, text_y, "Anggaran")
        c.drawString(11*cm, text_y, "Realisasi")
        c.drawString(15*cm, text_y, "%")
        c.setFont("Helvetica", 10)
        c.line(2*cm, text_y - 0.2*cm, 16*cm, text_y - 0.2*cm)
        
        rows = [
            ("Bahan Pangan (80%)", target_bahan, exp_bahan, pct(exp_bahan, target_bahan)),
            ("Insentif/Upah (15%)", target_upah, exp_upah, pct(exp_upah, target_upah)),
            ("Operasional (5%)", target_ops, exp_ops, pct(exp_ops, target_ops)),
        ]
        
        text_y -= 0.7*cm
        for r in rows:
            c.drawString(2*cm, text_y, r[0])
            c.drawString(7*cm, text_y, _rp(r[1]))
            c.drawString(11*cm, text_y, _rp(r[2]))
            c.drawString(15*cm, text_y, r[3])
            text_y -= 0.6*cm
            
        c.line(2*cm, text_y + 0.3*cm, 16*cm, text_y + 0.3*cm)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2*cm, text_y, "Total")
        c.drawString(7*cm, text_y, _rp(pencairan))
        c.drawString(11*cm, text_y, _rp(total_exp))
        c.setFont("Helvetica", 10)
        
        text_y -= 1*cm
        c.drawString(2*cm, text_y, f"Total porsi tersalurkan: {int(total_porsi)} porsi")
        text_y -= 0.6*cm
        c.drawString(2*cm, text_y, f"Jumlah sekolah: {jumlah_sekolah} sekolah")
        
        text_y -= 1*cm
        c.drawString(2*cm, text_y, f"Sisa dana: {_rp(sisa_dana)}")
        if sisa_dana > 0:
            text_y -= 0.6*cm
            c.drawString(2*cm, text_y, f"Sisa dana telah dikembalikan ke Kas Negara pada tanggal {return_date}")
            text_y -= 0.6*cm
            c.drawString(2*cm, text_y, f"melalui No. Bukti: {return_ref}")
            
        text_y -= 1*cm
        c.drawString(2*cm, text_y, "Demikian pernyataan ini dibuat dengan sebenarnya untuk dipergunakan")
        text_y -= 0.6*cm
        c.drawString(2*cm, text_y, "sebagaimana mestinya.")
        
        text_y -= 1.5*cm
        import datetime as dt
        today_str = dt.datetime.now().strftime("%d %B %Y")
        c.drawString(A4[0] - 6*cm, text_y, f"{city}, {today_str}")
        
        text_y -= 1*cm
        c.drawString(3*cm, text_y, "Mengetahui,")
        c.drawString(A4[0] - 6*cm, text_y, "Yang Menyatakan,")
        c.drawString(3*cm, text_y - 0.5*cm, "Kepala Satpel")
        
        text_y -= 3*cm
        c.drawString(3*cm, text_y, "(...........................)")
        c.drawString(A4[0] - 6*cm, text_y, f"( {owner_name} )")
        text_y -= 0.6*cm
        c.drawString(3*cm, text_y, "NIP:")
        c.drawString(A4[0] - 6*cm, text_y, f"NIK: {nik}")
        
        c.save()
        pdf_bytes = buffer.getvalue()
        
        filename = f"spt_{year}_{month:02d}.pdf"
        file_url = SPTService._upload_to_storage(supabase, tenant_id, filename, pdf_bytes)
        
        # Upsert
        SPTService._upsert_legal_doc(supabase, tenant_id, "spt", year, month, file_url)
        return {"file_url": file_url, "doc_number": no_spt}

    @staticmethod
    def generate_bap(tenant_id: str, year: int, month: int, supabase) -> str:
        tenant = SPTService._get_tenant(tenant_id, supabase)
        slug = tenant.get("slug") or "sppg"
        owner_name = tenant.get("owner_name") or "-"
        address = tenant.get("address") or "-"
        name = tenant.get("name") or "SPPG"
        
        first = date(year, month, 1)
        if month == 12:
            import datetime
            last = date(year + 1, 1, 1) - datetime.timedelta(days=1)
        else:
            import datetime
            last = date(year, month + 1, 1) - datetime.timedelta(days=1)
            
        # Get Kas Balances
        balances = KasService.get_all_balances(tenant_id, supabase)
        saldo_akhir = sum(b["current_balance"] for b in balances)
        
        # We need total income and expenses for the period
        trx_resp = supabase.table("transactions").select("total").eq("tenant_id", tenant_id).eq("status", "confirmed").gte("date", first.isoformat()).lte("date", last.isoformat()).execute()
        transactions = getattr(trx_resp, "data", None) or []
        total_keluar = sum(_d(t.get("total")) for t in transactions)
        
        del_resp = supabase.table("mbg_deliveries").select("portions_sent").eq("tenant_id", tenant_id).gte("delivery_date", first.isoformat()).lte("delivery_date", last.isoformat()).execute()
        total_porsi = sum(d.get("portions_sent", 0) for (d) in getattr(del_resp, "data", []) or [])
        alloc_resp = supabase.table("mbg_allocation_settings").select("price_per_portion").eq("tenant_id", tenant_id).limit(1).execute()
        price_pp = _d((getattr(alloc_resp, "data", None) or [{}])[0].get("price_per_portion", 15000))
        total_masuk = price_pp * _d(total_porsi)
        
        saldo_buku = total_masuk - total_keluar
        selisih = saldo_buku - _d(saldo_akhir)
        
        return_resp = supabase.table("kas_ledger").select("*").eq("tenant_id", tenant_id).eq("entry_type", "credit").eq("reference_type", "return_to_gov").gte("entry_date", first.isoformat()).lte("entry_date", last.isoformat()).execute()
        returns = getattr(return_resp, "data", None) or []
        return_date = returns[0]["entry_date"] if returns else "-"
        return_ref = returns[0]["description"].split("(Ref: ")[-1].replace(")", "") if returns and "(Ref: " in returns[0].get("description", "") else "-"
        
        # Draw PDF
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(A4[0]/2, A4[1] - 2*cm, name.upper())
        c.setFont("Helvetica", 10)
        c.drawCentredString(A4[0]/2, A4[1] - 2.5*cm, address)
        c.line(2*cm, A4[1] - 3*cm, A4[0]-2*cm, A4[1] - 3*cm)
        
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(A4[0]/2, A4[1] - 4*cm, "BERITA ACARA PEMERIKSAAN KAS")
        no_bap = f"BAP-{BULAN_ROMAWI[month]}/{year}/{slug}"
        c.setFont("Helvetica", 11)
        c.drawCentredString(A4[0]/2, A4[1] - 4.5*cm, f"Nomor: {no_bap}")
        
        text_y = A4[1] - 6*cm
        c.drawString(2*cm, text_y, f"Pada hari ini tanggal {last.strftime('%d')} bulan {BULAN_NAMA[month]} tahun {year}, kami")
        text_y -= 0.6*cm
        c.drawString(2*cm, text_y, "yang bertanda tangan di bawah ini telah melakukan pemeriksaan kas program MBG")
        text_y -= 0.6*cm
        c.drawString(2*cm, text_y, f"periode {BULAN_NAMA[month]} {year}.")
        
        text_y -= 1*cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2*cm, text_y, "Hasil Pemeriksaan:")
        c.setFont("Helvetica", 10)
        text_y -= 0.7*cm
        c.drawString(2.5*cm, text_y, f"Saldo Awal Periode  : {_rp(0)}") # Simplified
        text_y -= 0.6*cm
        c.drawString(2.5*cm, text_y, f"Total Penerimaan    : {_rp(total_masuk)}")
        text_y -= 0.6*cm
        c.drawString(2.5*cm, text_y, f"Total Pengeluaran   : {_rp(total_keluar)}")
        text_y -= 0.6*cm
        c.line(2.5*cm, text_y + 0.2*cm, 10*cm, text_y + 0.2*cm)
        c.drawString(2.5*cm, text_y, f"Saldo Akhir (Buku)  : {_rp(saldo_buku)}")
        text_y -= 0.6*cm
        c.drawString(2.5*cm, text_y, f"Saldo Fisik (Kas)   : {_rp(saldo_akhir)}")
        text_y -= 0.6*cm
        c.line(2.5*cm, text_y + 0.2*cm, 10*cm, text_y + 0.2*cm)
        c.drawString(2.5*cm, text_y, f"Selisih             : {_rp(selisih)}")
        
        text_y -= 1.2*cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2*cm, text_y, "Rincian per akun:")
        c.setFont("Helvetica", 10)
        for b in balances:
            text_y -= 0.6*cm
            c.drawString(2.5*cm, text_y, f"{b['name']} : {_rp(b['current_balance'])}")
            
        text_y -= 1.2*cm
        c.drawString(2*cm, text_y, f"Sisa kas sebesar {_rp(saldo_akhir)} telah disetorkan ke Kas Negara")
        text_y -= 0.6*cm
        c.drawString(2*cm, text_y, f"pada {return_date} (Ref: {return_ref})")
        
        text_y -= 1*cm
        c.drawString(2*cm, text_y, "Demikian berita acara ini dibuat untuk dipergunakan sebagaimana mestinya.")
        
        text_y -= 2*cm
        c.drawString(3*cm, text_y, "Pemeriksa I")
        c.drawString(10*cm, text_y, "Pemeriksa II")
        
        text_y -= 2*cm
        c.drawString(3*cm, text_y, "(....................)")
        c.drawString(10*cm, text_y, "(....................)")
        
        text_y -= 1.5*cm
        c.drawString(3*cm, text_y, "Mengetahui,")
        text_y -= 0.6*cm
        c.drawString(3*cm, text_y, "Penanggungjawab SPPG")
        text_y -= 2.5*cm
        c.drawString(3*cm, text_y, f"( {owner_name} )")
        
        c.save()
        pdf_bytes = buffer.getvalue()
        
        filename = f"bap_{year}_{month:02d}.pdf"
        file_url = SPTService._upload_to_storage(supabase, tenant_id, filename, pdf_bytes)
        
        # Upsert
        SPTService._upsert_legal_doc(supabase, tenant_id, "bap", year, month, file_url)
        return {"file_url": file_url, "doc_number": no_bap}

    @staticmethod
    def _upsert_legal_doc(supabase, tenant_id, doc_type, year, month, file_url):
        data = {
            "tenant_id": tenant_id,
            "doc_type": doc_type,
            "year": year,
            "month": month,
            "file_url": file_url,
            "status": "draft"
        }
        
        # Cek exist
        ex = supabase.table("legal_documents").select("id, status").eq("tenant_id", tenant_id).eq("doc_type", doc_type).eq("year", year).eq("month", month).execute()
        if getattr(ex, "data", None):
            # Update url and keep status unless it was final? Usually reset to draft or keep.
            supabase.table("legal_documents").update({"file_url": file_url, "generated_at": datetime.now().isoformat()}).eq("id", ex.data[0]["id"]).execute()
        else:
            supabase.table("legal_documents").insert(data).execute()
