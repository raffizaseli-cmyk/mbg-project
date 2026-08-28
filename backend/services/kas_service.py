from datetime import date
from decimal import Decimal
from models.user import UserInDB  # Import to get typing or use generic str

class KasService:
    @staticmethod
    def get_balance(kas_account_id: str, tenant_id: str, supabase, as_of_date: date = None) -> Decimal:
        """
        Ambil saldo kas pada tanggal tertentu.
        Default = saldo sekarang (today).
        """
        import datetime
        dt = as_of_date or datetime.date.today()
        result = (
            supabase.table("kas_ledger")
            .select("balance_after")
            .eq("kas_account_id", kas_account_id)
            .eq("tenant_id", tenant_id)
            .lte("entry_date", str(dt))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        
        if not result.data:
            return Decimal("0")
        return Decimal(str(result.data[0]["balance_after"]))

    @staticmethod
    def get_all_balances(tenant_id: str, supabase) -> list:
        """Return saldo semua kas accounts."""
        accounts = (
            supabase.table("kas_accounts")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .execute()
        )
        
        result = []
        for account in accounts.data:
            balance = KasService.get_balance(account["id"], tenant_id, supabase)
            result.append({
                **account,
                "current_balance": float(balance)
            })
        return result

    @staticmethod
    def record_entry(
        tenant_id: str,
        kas_account_id: str,
        entry_type: str,  # "debit" | "credit"
        amount: Decimal,
        reference_type: str,
        reference_id: str,
        description: str,
        entry_date: date,
        created_by: str,
        supabase
    ) -> dict:
        """
        Catat 1 baris di kas_ledger. Hitung balance_after otomatis.
        """
        current_balance = KasService.get_balance(kas_account_id, tenant_id, supabase)
        
        if entry_type == "debit":
            balance_after = current_balance + amount
        else:
            balance_after = current_balance - amount
            if balance_after < 0:
                raise ValueError(
                    f"Saldo kas tidak cukup. Saldo saat ini: {current_balance}, Dibutuhkan: {amount}"
                )
        
        # Insert ke kas_ledger
        entry = (
            supabase.table("kas_ledger")
            .insert({
                "tenant_id": tenant_id,
                "kas_account_id": kas_account_id,
                "entry_type": entry_type,
                "amount": float(amount),
                "balance_after": float(balance_after),
                "reference_type": reference_type,
                "reference_id": reference_id,
                "description": description,
                "entry_date": str(entry_date),
                "created_by": created_by
            })
            .execute()
        )
        
        # Update kas_accounts.current_balance (cache)
        (
            supabase.table("kas_accounts")
            .update({"current_balance": float(balance_after)})
            .eq("id", kas_account_id)
            .execute()
        )
        
        return entry.data[0]

    @staticmethod
    def transfer(
        tenant_id: str,
        from_account_id: str,
        to_account_id: str,
        amount: Decimal,
        transfer_date: date,
        notes: str,
        created_by: str,
        supabase
    ) -> dict:
        """
        Double entry transfer antar kas.
        """
        from_balance = KasService.get_balance(from_account_id, tenant_id, supabase)
        if from_balance < amount:
            raise ValueError(f"Saldo tidak cukup. Tersedia: Rp {from_balance}")
        
        # Insert fund_transfers record (Asumsi tabel sudah ada dari modul 19)
        transfer_req = {
            "tenant_id": tenant_id,
            "from_account_id": from_account_id,
            "to_account_id": to_account_id,
            "amount": float(amount),
            "transfer_date": str(transfer_date),
            "notes": notes,
            "created_by": created_by
        }
        transfer = supabase.table("fund_transfers").insert(transfer_req).execute()
        transfer_id = transfer.data[0]["id"]
        
        # Info account
        from_acc = supabase.table("kas_accounts").select("name").eq("id", from_account_id).execute().data[0]
        to_acc = supabase.table("kas_accounts").select("name").eq("id", to_account_id).execute().data[0]

        # Record 1: keluar dari kas asal
        KasService.record_entry(
            tenant_id, from_account_id, "credit", amount, "transfer", transfer_id,
            f"Transfer ke {to_acc['name']}: {notes}", transfer_date, created_by, supabase
        )
        
        # Record 2: masuk ke kas tujuan
        KasService.record_entry(
            tenant_id, to_account_id, "debit", amount, "transfer", transfer_id,
            f"Transfer dari {from_acc['name']}: {notes}", transfer_date, created_by, supabase
        )
        
        return transfer.data[0]

    @staticmethod
    def record_disbursement(
        tenant_id: str,
        disbursement_id: str,
        amount: Decimal,
        disbursement_date: date,
        reference_number: str,
        created_by: str,
        supabase
    ):
        """Pencairan dana MBG masuk VA Bank."""
        va_res = supabase.table("kas_accounts").select("id").eq("tenant_id", tenant_id).eq("type", "va_bank").execute()
        if not va_res.data:
            raise ValueError("Akun VA Bank belum disetup.")
        va_account_id = va_res.data[0]["id"]
        
        KasService.record_entry(
            tenant_id, va_account_id, "debit", amount, "disbursement", disbursement_id,
            f"Pencairan dana pemerintah (Ref: {reference_number})", disbursement_date, created_by, supabase
        )

    @staticmethod
    def record_expense(
        tenant_id: str,
        transaction_id: str,
        amount: Decimal,
        kas_account_id: str,
        description: str,
        expense_date: date,
        created_by: str,
        supabase,
        reference_type: str = "expense"
    ):
        """Catat pengeluaran (belanja/ops/gaji) dari kas tertentu."""
        # reference_type bisa "expense" atau "payroll"
        KasService.record_entry(
            tenant_id, kas_account_id, "credit", amount, reference_type, transaction_id,
            description, expense_date, created_by, supabase
        )

    @staticmethod
    def record_return_to_gov(
        tenant_id: str,
        return_id: str,
        amount: Decimal,
        return_date: date,
        created_by: str,
        supabase
    ):
        """Catat pengembalian sisa dana ke kas negara."""
        va_res = supabase.table("kas_accounts").select("id").eq("tenant_id", tenant_id).eq("type", "va_bank").execute()
        if not va_res.data:
            raise ValueError("Akun VA Bank belum disetup.")
        va_account_id = va_res.data[0]["id"]
        
        KasService.record_entry(
            tenant_id, va_account_id, "credit", amount, "return_to_gov", return_id,
            "Pengembalian sisa dana ke Kas Negara", return_date, created_by, supabase
        )

    @staticmethod
    def get_ledger(
        tenant_id: str,
        supabase,
        kas_account_id: str = None,
        start_date: date = None,
        end_date: date = None,
        limit: int = 200
    ) -> list:
        """Ambil riwayat buku kas."""
        query = supabase.table("kas_ledger").select("*").eq("tenant_id", tenant_id)
        if kas_account_id:
            query = query.eq("kas_account_id", kas_account_id)
        if start_date:
            query = query.gte("entry_date", str(start_date))
        if end_date:
            query = query.lte("entry_date", str(end_date))
            
        result = query.order("entry_date", desc=True).order("created_at", desc=True).limit(limit).execute()
        return result.data
