import requests

def test_api():
    base_url = "http://127.0.0.1:8000"
    
    # 1. Login
    res = requests.post(f"{base_url}/auth/login", json={"email": "sppg@mbg.com", "password": "password"})
    if res.status_code != 200:
        print("Login failed:", res.status_code, res.text)
        return
    token = res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Test Excel
    res_excel = requests.post(f"{base_url}/legal/excel-dinas/generate", json={"year": 2026, "month": 3}, headers=headers)
    print("EXCEL RESP:", res_excel.status_code, res_excel.text)
    
    # 3. Test SPT
    res_spt = requests.post(f"{base_url}/legal/spt/generate", json={"year": 2026, "month": 3}, headers=headers)
    print("SPT RESP:", res_spt.status_code, res_spt.text)
    
    # 4. Test Role POST
    res_role = requests.post(f"{base_url}/employees/positions", json={"id":"", "name": "Tester", "salary_type": "harian", "base_salary": 1000}, headers=headers)
    print("ROLE RESP:", res_role.status_code, res_role.text)

if __name__ == "__main__":
    test_api()
