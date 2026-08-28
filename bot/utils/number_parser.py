def parse_id_number(val: any) -> float:
    """
    Mengubah format angka Indonesia ke Float Python.
    Contoh: 
    '1.500,50' -> 1500.5
    '24,5'     -> 24.5
    '1.000'    -> 1000.0
    """
    if val is None or val == '':
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    
    s = str(val).strip()
    
    # Kasus: Ada titik (.) dan koma (,) -> 1.500,50
    if '.' in s and ',' in s:
        s = s.replace('.', '').replace(',', '.')
    # Kasus: Hanya ada koma (,) -> 24,5 (desimal ID)
    elif ',' in s:
        s = s.replace(',', '.')
    # Kasus: Hanya ada titik (.) -> 1.000 (ribuan ID) atau 1.5 (desimal Int)
    elif '.' in s:
        parts = s.split('.')
        # Heuristik: Jika persis 3 angka di belakang titik terakhir, kemungkinan ribuan
        if len(parts[-1]) == 3:
            s = s.replace('.', '')
            
    try:
        return float(s)
    except ValueError:
        return 0.0
