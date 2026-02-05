/**
 * Load officers & staff and executive board from the Local 34 E-Board Excel file.
 * Set L34_EBOARD_XLSX_PATH to the full path of the xlsx (e.g. your Box path), or
 * copy the file to src/data/2026-l34-eboard.xlsx.
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
  'Recording Secretary',
  'Cheif Steward',
  'Chief Steward',
  'Cheief Steward',
  'Elected Organizer',
  'Communications Director & Elected Organizer',
  'Staff Organizer',
  'Job Search Team',
  'Research Director',
  'Researcher',
  'Communications',
  'Communications  ',
];

function officerSortKey(title: string): number {
  const i = OFFICER_ORDER.indexOf(title);
  return i >= 0 ? i : OFFICER_ORDER.length;
}

const XLSX_FILENAMES = ['2026-l34-eboard.xlsx', '2026 L34 E-Board List.xlsx'];

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
  const envPath =
    typeof process !== 'undefined' && process.env?.L34_EBOARD_XLSX_PATH ? process.env.L34_EBOARD_XLSX_PATH : null;
  const xlsxPath = envPath
    ? envPath
    : XLSX_FILENAMES.map((name) => path.join(dataDir, name)).find((p) => fs.existsSync(p));

  if (!xlsxPath || !fs.existsSync(xlsxPath)) {
    console.warn(
      `[eboard] xlsx not found. Set L34_EBOARD_XLSX_PATH or copy the file to src/data/ as one of: ${XLSX_FILENAMES.join(', ')}.`
    );
    return { officersAndStaff: [], executiveBoard: [] };
  }

  const buf = fs.readFileSync(xlsxPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf as Buffer);
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
    const emailRaw = nonYaleEmail || yaleEmail;
    const email =
      emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+/.test(emailRaw) ? emailRaw : undefined;

    if (title && name) {
      officersAndStaff.push({ name, title, email });
    }

    if (name && department && !Number.isNaN(district) && district > 0) {
      executiveBoard.push({
        name,
        area: department,
        district: Math.floor(district),
        email,
      });
    }
  });

  officersAndStaff.sort((a, b) => officerSortKey(a.title) - officerSortKey(b.title));
  executiveBoard.sort((a, b) => (a.district ?? 0) - (b.district ?? 0));

  return { officersAndStaff, executiveBoard };
}
