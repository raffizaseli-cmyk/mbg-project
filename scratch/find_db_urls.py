import os
from dotenv import dotenv_values

for root, dirs, files in os.walk("."):
    if "node_modules" in root or ".git" in root or ".venv" in root:
        continue
    for f in files:
        if f.startswith(".env"):
            p = os.path.join(root, f)
            vals = dotenv_values(p)
            print(f"File '{p}': keys = {list(vals.keys())}")
            if "DATABASE_URL" in vals:
                print(f"   -> Found DATABASE_URL in {p}")
