import os
import sys
import zipfile

def extract_archive(zip_path, extract_to):
    if not os.path.exists(zip_path):
        print(f"ERROR: {zip_path} does not exist")
        sys.exit(1)
    
    os.makedirs(extract_to, exist_ok=True)
    found_csvs = []
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            for item in z.namelist():
                if item.lower().endswith('.csv'):
                    target_name = os.path.basename(item)
                    if not target_name:
                        continue
                    out_path = os.path.join(extract_to, target_name)
                    with z.open(item) as src, open(out_path, 'wb') as dst:
                        while chunk := src.read(1024 * 1024):
                            dst.write(chunk)
                    found_csvs.append(out_path)
                    print(f"Extracted: {out_path} ({os.path.getsize(out_path)} bytes)")
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    if not found_csvs:
        print("WARN: No CSV files found in zip")
    else:
        print(f"SUCCESS: Extracted {len(found_csvs)} CSV files")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: extract_zip.py <zip_path> <extract_to_dir>")
        sys.exit(1)
    extract_archive(sys.argv[1], sys.argv[2])
