# Local 34 E-Board data

To build the **Who We Are** page from the official E-Board Excel file:

1. **Option A**: Copy `2026 L34 E-Board List.xlsx` into this folder and rename it to `2026-l34-eboard.xlsx`.
2. **Option B**: Set the env var `L34_EBOARD_XLSX_PATH` to the full path of the xlsx (e.g. your Box path) before `npm run build` or `npm run dev`.

If the file is missing, the about page will show empty Officers & Staff and Executive Board sections.
