import glob

for f in glob.glob(r"c:\folder fix\bot\handlers\*.py"):
    with open(f, 'r', encoding='utf-8') as file:
        data = file.read()
    
    # Check if there is a literal backslash before the quote
    if r"\'status_code\'" in data:
        data = data.replace(r"\'status_code\'", '"status_code"')
        with open(f, 'w', encoding='utf-8') as file:
            file.write(data)
        print("Fixed", f)
