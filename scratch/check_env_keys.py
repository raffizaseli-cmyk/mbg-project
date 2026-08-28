import os
from dotenv import dotenv_values

vals = dotenv_values(os.path.join("backend", ".env"))
print("Keys in backend/.env:", list(vals.keys()))
