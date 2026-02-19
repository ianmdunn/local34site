/**
 * Load officers & staff and executive board for the who-we-are page.
 *
 * Primary source: CSV files in src/data/
 *   - officers-and-staff.csv (name, title, email) — row order = display order
 *   - executive-board.csv (dist, name, department, personal_email, yale_email) — sorted by district
 *
 * Fallback: Excel file (set L34_EBOARD_XLSX_PATH or copy to src/data/)
 */

import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

export interface OfficerOrStaff {
  name: string;
  title: string;
  email?: string;
}

export interface ExecutiveBoardMember {
  name: string;
  area: string;
  district?: number;
  email?: string;
}

export interface EboardData {
  officersAndStaff: OfficerOrStaff[];
  executiveBoard: ExecutiveBoardMember[];
}

const OFFICER_ORDER = [
  'President',
  'Secretary-Treasurer',
  'Organizing Director',
  'Organizing Director & Chief Steward',
  'Vice President',
  'Vice President - Medical Area',
  'Vice President, Medical Area',
  'Vice President, Science Area',
  'Vice President - Central Area',
  'Recording Secretary',
  'Cheif Steward',
  'Chief Steward',
  'Cheief Steward',
  'Chief Stweard & Staff Director',
  'Elected Organizer',
  'Communications Director & Elected Organizer',
  'Elected Organizer & Communications Director',
  'Staff Organizer',
  'Job Search Team',
  'Research Director',
  'Researcher',
  'Communications',
  'Communications  ',
];

const STAFF_TITLES = new Set([
  'Staff Organizer',
  'Job Search Team',
  'Research Director',
  'Researcher',
  'Communications',
  'Communications  ',
]);

function officerSortKey(title: string): number {
  const i = OFFICER_ORDER.indexOf(title);
  return i >= 0 ? i : OFFICER_ORDER.length;
}

function isStaff(title: string): boolean {
  return STAFF_TITLES.has(title.trim());
}

const CSV_FILENAMES = {
  officers: 'officers-and-staff.csv',
  exec: 'executive-board.csv',
} as const;

const XLSX_FILENAMES = ['2026-l34-eboard.xlsx', '2026 L34 E-Board List.xlsx'];

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** For exec board links: prefer @yaleunions.org, else yale email */
function pickLinkEmail(personalEmail: string, yaleEmail: string): string {
  if (personalEmail && personalEmail.toLowerCase().includes('@yaleunions.org') && isValidEmail(personalEmail))
    return personalEmail;
  if (yaleEmail && yaleEmail.toLowerCase().includes('@yaleunions.org') && isValidEmail(yaleEmail)) return yaleEmail;
  if (yaleEmail && isValidEmail(yaleEmail)) return yaleEmail;
  if (personalEmail && isValidEmail(personalEmail)) return personalEmail;
  return '';
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]!);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVRow(lines[i]!);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = cells[j]?.trim() ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let cell = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          i++;
          if (line[i] === '"') {
            cell += '"';
            i++;
          } else break;
        } else {
          cell += line[i];
          i++;
        }
      }
      result.push(cell);
      if (line[i] === ',') i++;
    } else {
      const comma = line.indexOf(',', i);
      if (comma === -1) {
        result.push(line.slice(i).trim());
        break;
      }
      result.push(line.slice(i, comma).trim());
      i = comma + 1;
    }
  }
  return result;
}

function loadFromCSV(dataDir: string): EboardData | null {
  const officersPath = path.join(dataDir, CSV_FILENAMES.officers);
  const execPath = path.join(dataDir, CSV_FILENAMES.exec);
  if (!fs.existsSync(officersPath) || !fs.existsSync(execPath)) return null;

  const officersRows = parseCSV(fs.readFileSync(officersPath, 'utf-8'));
  const execRows = parseCSV(fs.readFileSync(execPath, 'utf-8'));

  const officersAndStaff: OfficerOrStaff[] = officersRows
    .filter((r) => (r['name'] ?? '').trim())
    .map((r) => {
      const email = (r['email'] ?? '').trim();
      return {
        name: (r['name'] ?? '').trim(),
        title: (r['title'] ?? '').trim(),
        email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+/.test(email) ? email : undefined,
      };
    });

  const executiveBoard: ExecutiveBoardMember[] = execRows
    .filter((r) => (r['name'] ?? '').trim() && (r['department'] ?? r['area'] ?? '').trim())
    .map((r) => {
      const district = parseInt((r['dist'] ?? r['district'] ?? '').trim(), 10);
      const validDistrict = !Number.isNaN(district) && district >= 1 && district <= 50 ? district : undefined;
      const personalEmail = (r['personal_email'] ?? '').trim();
      const yaleEmail = (r['yale_email'] ?? '').trim();
      const email = pickLinkEmail(personalEmail, yaleEmail);
      return {
        name: (r['name'] ?? '').trim(),
        area: (r['department'] ?? r['area'] ?? '').trim(),
        district: validDistrict,
        email: email || undefined,
      };
    })
    .filter((m) => m.district != null)
    .sort((a, b) => (a.district ?? 0) - (b.district ?? 0));

  return { officersAndStaff, executiveBoard };
}

function getCellValue(val: ExcelJS.CellValue): string {
  if (val == null) return '';
  if (typeof val === 'object' && 'text' in val) return String((val as { text: string }).text).trim();
  return String(val).trim();
}

function getCellNumber(val: ExcelJS.CellValue): number {
  if (val == null) return NaN;
  const n = Number(val);
  return Number.isNaN(n) ? NaN : n;
}

export async function getEboardFromXlsx(): Promise<EboardData> {
  const projectRoot = process.cwd();
  const dataDir = path.join(projectRoot, 'src', 'data');

  const csvData = loadFromCSV(dataDir);
  if (csvData) return csvData;

  return loadFromXlsx(dataDir);
}

async function loadFromXlsx(dataDir: string): Promise<EboardData> {
  const envPath =
    typeof process !== 'undefined' && process.env?.L34_EBOARD_XLSX_PATH ? process.env.L34_EBOARD_XLSX_PATH : null;
  const xlsxPath = envPath
    ? envPath
    : XLSX_FILENAMES.map((name) => path.join(dataDir, name)).find((p) => fs.existsSync(p));

  if (!xlsxPath || !fs.existsSync(xlsxPath)) {
    console.warn(
      `[eboard] No CSV or xlsx found. Add src/data/officers-and-staff.csv and executive-board.csv, or set L34_EBOARD_XLSX_PATH.`
    );
    return { officersAndStaff: [], executiveBoard: [] };
  }

  const buf = fs.readFileSync(xlsxPath);
  const workbook = new ExcelJS.Workbook();
  // ExcelJS expects Buffer; Node's Buffer type has changed in TS defs
  // @ts-expect-error - Buffer from fs.readFileSync is compatible at runtime
  await workbook.xlsx.load(buf);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { officersAndStaff: [], executiveBoard: [] };

  const headerRow = worksheet.getRow(1);
  const colIndex: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const header = getCellValue(cell.value);
    if (header) colIndex[header] = colNumber;
  });

  const get = (row: ExcelJS.Row, key: string): string => {
    const col = colIndex[key];
    return col ? getCellValue(row.getCell(col)?.value) : '';
  };
  const getNum = (row: ExcelJS.Row, key: string): number => {
    const col = colIndex[key];
    return col ? getCellNumber(row.getCell(col)?.value) : NaN;
  };

  const officersAndStaff: OfficerOrStaff[] = [];
  const executiveBoard: ExecutiveBoardMember[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = get(row, 'Name');
    const title = get(row, 'Title');
    const department = get(row, 'Department');
    const district = getNum(row, 'District');
    const yaleEmail = get(row, 'Yale Email');
    const nonYaleEmail = get(row, 'Non-Yale Email');

    if (title && name) {
      const email = nonYaleEmail || yaleEmail;
      officersAndStaff.push({
        name,
        title,
        email: email && isValidEmail(email) ? email : undefined,
      });
    }

    const d = Math.floor(district);
    if (name && department && !Number.isNaN(district) && district >= 1 && district <= 50) {
      const linkEmail = pickLinkEmail(nonYaleEmail, yaleEmail);
      executiveBoard.push({
        name,
        area: department,
        district: d,
        email: linkEmail || undefined,
      });
    }
  });

  officersAndStaff.sort((a, b) => {
    const aStaff = isStaff(a.title);
    const bStaff = isStaff(b.title);
    if (aStaff !== bStaff) return aStaff ? 1 : -1;
    return officerSortKey(a.title) - officerSortKey(b.title);
  });
  executiveBoard.sort((a, b) => (a.district ?? 0) - (b.district ?? 0));

  return { officersAndStaff, executiveBoard };
}
