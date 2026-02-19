# Local 34 E-Board data

The **Who We Are** page reads from CSV files in this folder (primary) or an Excel file (fallback).

## Primary: Edit the CSV files

1. **officers-and-staff.csv** — Officers & Staff section
   - Columns: `name`, `title`, `email`
   - Row order = display order (edit rows to reorder)

2. **executive-board.csv** — Executive Board section
   - Columns: `dist`, `name`, `department`, `personal_email`, `yale_email`
   - Districts 1–50. Only occupied districts (rows in CSV) are shown. Sorted by district.
   - Site links use Yale email; if anyone has @yaleunions.org, that is preferred.

Edit these CSVs in any spreadsheet app (Excel, Google Sheets, etc.) and save as CSV. Rebuild the site to see changes.

## Fallback: Excel file

If the CSV files are missing:

- Copy `2026 L34 E-Board List.xlsx` into this folder as `2026-l34-eboard.xlsx`, or
- Set `L34_EBOARD_XLSX_PATH` to the full path of the xlsx before `npm run build` or `npm run dev`.
