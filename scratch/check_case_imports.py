import os
import re

web_dir = r"c:\Users\Lenovo\OneDrive\folder fix\web"

# Collect all actual file paths with exact casing
actual_files = set()
for root, dirs, files in os.walk(web_dir):
    if "node_modules" in root or ".next" in root:
        continue
    for f in files:
        rel = os.path.relpath(os.path.join(root, f), web_dir).replace("\\", "/")
        actual_files.add(rel)
        actual_files.add(rel.lower())

print(f"Indexed {len(actual_files)} files in web/")

# Check imports in .ts and .tsx files
import_pattern = re.compile(r'(?:import|export)\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]')

issues = []
for root, dirs, files in os.walk(web_dir):
    if "node_modules" in root or ".next" in root:
        continue
    for f in files:
        if f.endswith(".ts") or f.endswith(".tsx"):
            filepath = os.path.join(root, f)
            with open(filepath, "r", encoding="utf-8", errors="ignore") as file_content:
                lines = file_content.readlines()
            for idx, line in enumerate(lines, 1):
                matches = import_pattern.findall(line)
                for imp in matches:
                    if imp.startswith("@/"):
                        target_rel = imp[2:]
                    elif imp.startswith("./") or imp.startswith("../"):
                        rel_dir = os.path.relpath(root, web_dir).replace("\\", "/")
                        target_rel = os.path.normpath(os.path.join(rel_dir, imp)).replace("\\", "/")
                    else:
                        continue
                    
                    # Try extensions .ts, .tsx, /index.ts, /index.tsx
                    candidates = [
                        target_rel,
                        target_rel + ".ts",
                        target_rel + ".tsx",
                        target_rel + "/index.ts",
                        target_rel + "/index.tsx",
                    ]

                    # Check if lower case exists but exact case does not
                    found_exact = False
                    found_case_diff = False
                    matched_file = None

                    for root_check, dirs_check, files_check in os.walk(web_dir):
                        if "node_modules" in root_check or ".next" in root_check:
                            continue
                        for fc in files_check:
                            full = os.path.normpath(os.path.join(root_check, fc)).replace("\\", "/")
                            rel_full = os.path.relpath(full, web_dir).replace("\\", "/")
                            for cand in candidates:
                                if rel_full == cand:
                                    found_exact = True
                                elif rel_full.lower() == cand.lower():
                                    found_case_diff = True
                                    matched_file = rel_full

                    if found_case_diff and not found_exact:
                        issues.append((filepath, idx, imp, matched_file))

print("\n--- CASE SENSITIVITY IMPORT ISSUES ---")
for file, line, imp, matched in issues:
    print(f"[{file}:{line}] Import '{imp}' does not match disk case '{matched}'")

if not issues:
    print("No case sensitivity import issues found!")
