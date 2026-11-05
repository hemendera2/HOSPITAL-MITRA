#!/usr/bin/env python3
"""
Import real hospital data from the Indian hospital database CSV files into
the Hospital Mitra SQLite database.

Usage:
    python3 scripts/import_hospitals.py [--csv <path>] [--limit <n>]

Data sources (all real, publicly available government hospital directories):
  - hospital_database-may_2016.csv  (30,273 hospitals, comprehensive)
  - hospital_directory.csv          (30,273 hospitals, numeric fields)
  - Hospital_with_discipline_jul_15.csv  (1,050 hospitals, with specialties)
  - datafile.csv                    (657 hospitals, structured)

Important: This script imports hospital DIRECTORY data only (name, location,
contact, bed count, coordinates). It does NOT create any indoor maps, room
numbers, or department layouts. All imported hospitals are marked as
`unmapped` with `map_verified = 0` — they become visible in the patient app
directory but indoor navigation is not available until a verified map is
digitised by an authorised editor.
"""

import csv
import os
import sys
import uuid
from pathlib import Path

# --- SQLite via Node? No — we use Python's sqlite3 directly ---
# The backend uses node:sqlite, but for a one-off import script it's simpler
# to use Python's built-in sqlite3 module on the same .db file.
import sqlite3

DB_PATH = os.path.join(
    os.path.dirname(__file__), "..", ".data", "hospital-mitra.sqlite"
)

# Field mapping from CSV → our schema
def parse_coords(raw: str):
    """Parse 'lat, lng' string → (lat, lng) floats or (None, None)."""
    raw = raw.strip()
    if not raw or raw == "NA" or raw == "0":
        return None, None
    parts = raw.replace(" ", "").split(",")
    if len(parts) == 2:
        try:
            return float(parts[0]), float(parts[1])
        except ValueError:
            return None, None
    return None, None


def parse_int(raw: str):
    raw = raw.strip()
    if not raw or raw == "NA" or raw == "0":
        return None
    try:
        return int(raw)
    except ValueError:
        try:
            return int(float(raw))
        except ValueError:
            return None


def parse_phone(raw: str):
    raw = raw.strip()
    if not raw or raw == "NA" or raw == "0":
        return None
    # Keep only digits and leading +
    import re
    cleaned = re.sub(r'[^\d+]', '', raw)
    return cleaned or None


def clean_name(raw: str):
    raw = raw.strip()
    if not raw or raw == "NA":
        return None
    # Remove leading numbers like "1." "2."
    import re
    cleaned = re.sub(r'^\d+\.\s*', '', raw)
    return cleaned or None


def import_from_database_csv(csv_path: str, limit: int = 0):
    """Import from hospital_database-may_2016.csv (comprehensive format)."""
    rows_imported = 0
    rows_skipped = 0

    with open(csv_path, 'r', encoding='latin-1') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = clean_name(row.get('Hospital_Name', ''))
            state = row.get('State', '').strip()
            district = row.get('District', '').strip()

            if not name or not state or state == 'NA':
                rows_skipped += 1
                continue

            lat, lng = parse_coords(row.get('Location_Coordinates', ''))
            beds = parse_int(row.get('Total_Num_Beds', ''))
            tel = parse_phone(row.get('Telephone', ''))
            emg = parse_phone(row.get('Emergency_Num', '')) or tel
            website = row.get('Website', '').strip()
            if not website or website == 'NA':
                website = None

            h_type = row.get('Hospital_Category', '').strip()
            if not h_type or h_type == 'NA':
                h_type = None

            addr = row.get('Address_Original_First_Line', '').strip()
            if not addr or addr == 'NA':
                addr = None

            row_data = (
                str(uuid.uuid4()),
                name[:200],
                None,  # short_name
                state[:100],
                district[:100] or state,
                state,
                'IN',
                addr,
                lat,
                lng,
                emg,
                h_type,
                beds,
                'unmapped',
                0,
                None,  # map_last_updated_at
                0,     # is_demo — REAL data from government directory
                0,     # is_active
            )
            rows_imported += 1
            if limit and rows_imported >= limit:
                break

    return rows_imported, rows_skipped


def import_from_discipline_csv(csv_path: str, limit: int = 0):
    """Import from Hospital_with_discipline_jul_15.csv (has specialties)."""
    rows_imported = 0
    rows_skipped = 0

    with open(csv_path, 'r', encoding='latin-1') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = clean_name(row.get('Hospital / Private', ''))
            state = row.get('State', '').strip()
            city = row.get('City', '').strip()

            if not name or not state or state == 'NA':
                rows_skipped += 1
                continue

            district = city if city and city != 'NA' else state
            tel = parse_phone(row.get('Contact Details', ''))
            website = row.get('Website link', '').strip()
            if not website or website == 'NA':
                website = None

            contact = row.get('Contact Details', '')
            # Extract pin code
            pin = None
            for token in contact.split():
                if token.isdigit() and len(token) == 6:
                    pin = token
                    break

            row_data = (
                str(uuid.uuid4()),
                name[:200],
                None,
                state[:100],
                district[:100] or state,
                state,
                'IN',
                contact[:500] if contact and contact != 'NA' else None,
                None,  # lat
                None,  # lng
                tel,
                None,  # h_type
                None,  # beds
                'unmapped',
                0,
                None,
                0,  # is_demo
                0,
            )
            rows_imported += 1
            if limit and rows_imported >= limit:
                break

    return rows_imported, rows_skipped


def import_from_datafile_csv(csv_path: str, limit: int = 0):
    """Import from datafile.csv (structured with coordinates)."""
    rows_imported = 0
    rows_skipped = 0

    with open(csv_path, 'r', encoding='latin-1') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = clean_name(row.get('hospitalname', ''))
            state = row.get('state', '').strip()
            district = row.get('district', '').strip()

            if not name or not state or state == 'NA':
                rows_skipped += 1
                continue

            lat_str = row.get('googlemapcorridinate_lati', '').strip()
            lng_str = row.get('googlemapcorridinate_longi', '').strip()
            lat = float(lat_str) if lat_str and lat_str != 'NA' else None
            lng = float(lng_str) if lng_str and lng_str != 'NA' else None

            beds = parse_int(row.get('totalnumofbeds', ''))
            tel = parse_phone(row.get('telephone', ''))
            website = row.get('website', '').strip()
            if not website or website == 'NA':
                website = None

            h_type = row.get('Category', '').strip()
            if not h_type or h_type == 'NA':
                h_type = None

            addr = row.get('address First Line', '').strip()
            if not addr or addr == 'NA':
                addr = None

            row_data = (
                str(uuid.uuid4()),
                name[:200],
                None,
                state[:100],
                district[:100] or state,
                state,
                'IN',
                addr,
                lat,
                lng,
                tel,
                h_type,
                beds,
                'unmapped',
                0,
                None,
                0,  # is_demo
                0,
            )
            rows_imported += 1
            if limit and rows_imported >= limit:
                break

    return rows_imported, rows_skipped


def main():
    csv_dir = "/tmp/arena-coding-uploads"
    limit = 0

    # Check if DB exists
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        print("Start the backend once to create the database, then run this script.")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    total_imported = 0
    total_skipped = 0

    # Import from hospital_database-may_2016.csv
    db_csv = os.path.join(csv_dir, "hospital_database-may_2016.csv")
    if os.path.exists(db_csv):
        print(f"Importing from {os.path.basename(db_csv)}...")
        imported, skipped = import_from_database_csv(db_csv, limit)
        print(f"  Parsed: {imported + skipped}, Imported: {imported}, Skipped: {skipped}")

        for row_data in []:  # placeholder — actual insert happens below
            pass

        # Insert in batch
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        insert_sql = """
            INSERT OR IGNORE INTO hospitals
            (id, name, short_name, city, district, state, country, address,
             latitude, longitude, phone_emergency, hospital_type, bed_count,
             mapping_status, map_verified, map_last_updated_at, is_demo, is_active,
             created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """

        # Re-read and insert
        with open(db_csv, 'r', encoding='latin-1') as f:
            reader = csv.DictReader(f)
            batch = []
            for row in reader:
                name = clean_name(row.get('Hospital_Name', ''))
                state = row.get('State', '').strip()
                district = row.get('District', '').strip()
                if not name or not state or state == 'NA':
                    continue

                lat, lng = parse_coords(row.get('Location_Coordinates', ''))
                beds = parse_int(row.get('Total_Num_Beds', ''))
                tel = parse_phone(row.get('Telephone', ''))
                emg = parse_phone(row.get('Emergency_Num', '')) or tel
                website = row.get('Website', '').strip()
                if not website or website == 'NA':
                    website = None

                h_type = row.get('Hospital_Category', '').strip()
                if not h_type or h_type == 'NA':
                    h_type = None

                addr = row.get('Address_Original_First_Line', '').strip()
                if not addr or addr == 'NA':
                    addr = None

                batch.append((
                    str(uuid.uuid4()), name[:200], None,
                    state[:100], district[:100] or state, state, 'IN', addr,
                    lat, lng, emg, h_type, beds,
                    'unmapped', 0, None, 0, 1, now, now,
                ))

                if len(batch) >= 500:
                    cur.executemany(insert_sql, batch)
                    total_imported += len(batch)
                    batch = []
                    print(f"  ...{total_imported} imported")

            if batch:
                cur.executemany(insert_sql, batch)
                total_imported += len(batch)

        print(f"  Done: {total_imported} hospitals imported from database CSV")

    # Import from Hospital_with_discipline_jul_15.csv
    disc_csv = os.path.join(csv_dir, "Hospital_with_discipline_jul_15.csv")
    if os.path.exists(disc_csv):
        print(f"\nImporting from {os.path.basename(disc_csv)}...")
        disc_imported = 0
        with open(disc_csv, 'r', encoding='latin-1') as f:
            reader = csv.DictReader(f)
            batch = []
            for row in reader:
                name = clean_name(row.get('Hospital / Private', ''))
                state = row.get('State', '').strip()
                city = row.get('City', '').strip()
                if not name or not state or state == 'NA':
                    continue

                district = city if city and city != 'NA' else state
                tel = parse_phone(row.get('Contact Details', ''))
                website = row.get('Website link', '').strip()
                if not website or website == 'NA':
                    website = None
                contact = row.get('Contact Details', '')

                batch.append((
                    str(uuid.uuid4()), name[:200], None,
                    state[:100], district[:100] or state, state, 'IN',
                    contact[:500] if contact and contact != 'NA' else None,
                    None, None, tel, None, None,
                    'unmapped', 0, None, 0, 1, now, now,
                ))

                if len(batch) >= 500:
                    cur.executemany(insert_sql, batch)
                    disc_imported += len(batch)
                    batch = []

            if batch:
                cur.executemany(insert_sql, batch)
                disc_imported += len(batch)

        total_imported += disc_imported
        print(f"  Done: {disc_imported} hospitals imported from discipline CSV")

    # Import from datafile.csv
    data_csv = os.path.join(csv_dir, "datafile.csv")
    if os.path.exists(data_csv):
        print(f"\nImporting from {os.path.basename(data_csv)}...")
        data_imported = 0
        with open(data_csv, 'r', encoding='latin-1') as f:
            reader = csv.DictReader(f)
            batch = []
            for row in reader:
                name = clean_name(row.get('hospitalname', ''))
                state = row.get('state', '').strip()
                district = row.get('district', '').strip()
                if not name or not state or state == 'NA':
                    continue

                lat_str = row.get('googlemapcorridinate_lati', '').strip()
                lng_str = row.get('googlemapcorridinate_longi', '').strip()
                lat = float(lat_str) if lat_str and lat_str != 'NA' else None
                lng = float(lng_str) if lng_str and lng_str != 'NA' else None
                beds = parse_int(row.get('totalnumofbeds', ''))
                tel = parse_phone(row.get('telephone', ''))
                website = row.get('website', '').strip()
                if not website or website == 'NA':
                    website = None
                h_type = row.get('Category', '').strip()
                if not h_type or h_type == 'NA':
                    h_type = None
                addr = row.get('address First Line', '').strip()
                if not addr or addr == 'NA':
                    addr = None

                batch.append((
                    str(uuid.uuid4()), name[:200], None,
                    state[:100], district[:100] or state, state, 'IN', addr,
                    lat, lng, tel, h_type, beds,
                    'unmapped', 0, None, 0, 1, now, now,
                ))

                if len(batch) >= 500:
                    cur.executemany(insert_sql, batch)
                    data_imported += len(batch)
                    batch = []

            if batch:
                cur.executemany(insert_sql, batch)
                data_imported += len(batch)

        total_imported += data_imported
        print(f"  Done: {data_imported} hospitals imported from datafile CSV")

    conn.commit()

    # Stats
    cur.execute("SELECT COUNT(*) FROM hospitals")
    total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM hospitals WHERE state = 'Rajasthan'")
    raj_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM hospitals WHERE district = 'Kota' OR city = 'Kota'")
    kota_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM hospitals WHERE is_demo = 1")
    demo_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM hospitals WHERE is_demo = 0")
    real_count = cur.fetchone()[0]

    print(f"\n{'='*50}")
    print(f"Import complete!")
    print(f"  Total hospitals: {total}")
    print(f"  Rajasthan: {raj_count}")
    print(f"  Kota: {kota_count}")
    print(f"  Real (from CSV): {real_count}")
    print(f"  DEMO: {demo_count}")
    print(f"{'='*50}")

    conn.close()


if __name__ == '__main__':
    main()
