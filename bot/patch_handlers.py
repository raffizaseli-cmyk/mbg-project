import glob, re
import os

for f in glob.glob(r"c:\folder fix\bot\handlers\*.py"):
    # Read the content first
    with open(f, 'r', encoding='utf-8') as file:
        data = file.read()
    
    # Check if we already injected
    if "if getattr(e, 'status_code', 0) in (401, 403): raise e" in data:
        continue
        
    # Replace matches
    data = re.sub(
        r'([ \t]*)except Exception as e:\n', 
        r'\1except Exception as e:\n\1    if getattr(e, \'status_code\', 0) in (401, 403): raise e\n', 
        data
    )
    
    # Write back safely
    with open(f, 'w', encoding='utf-8') as file:
        file.write(data)
    print(f"Patched {os.path.basename(f)}")
