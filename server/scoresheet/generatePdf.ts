/**
 * Score Sheet PDF Generator
 * 
 * Generates exam score sheets as a single PDF using pre-designed template images
 * as full-page backgrounds with student name and exam date overlaid.
 * 
 * Logic: 白帶考黃帶 → uses 白帶 template (currentBelt determines template)
 * Ordered by exam schedule groups (timetable order)
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Use process.cwd() since esbuild bundles to dist/ but runs from project root
const SCORESHEET_DIR = path.join(process.cwd(), 'server/scoresheet');
const TEMPLATES_DIR = path.join(SCORESHEET_DIR, 'templates');
const FONT_PATH = path.join(SCORESHEET_DIR, 'NotoSansCJKtc-Regular.otf');

// Template mapping: currentBelt → template file
const BELT_TEMPLATE_MAP: Record<string, string> = {
  white: 'white.png',
  yellow: 'yellow.png',
  yellowGreen: 'yellowGreen.png',
  yellow_green: 'yellowGreen.png',
  green: 'green.png',
  greenBlue: 'greenBlue.png',
  green_blue: 'greenBlue.png',
  blue: 'blue.png',
  blueRed: 'blueRed.png',
  blue_red: 'blueRed.png',
  red: 'red.png',
  redBlack: 'redBlack.png',
  red_black: 'redBlack.png',
  black: 'black_dan.png',
  black_dan: 'black_dan.png',
  black_poom: 'black_poom.png',
};

// Text overlay positions (PDF points, A4 landscape 842x595)
// Image 1024x724 → PDF 842x595, scaleX=0.8223, scaleY=0.8216
// Positioned right after the colon (：) of each label:
//   考生姓名： label at imgY=617-631, colon right edge imgX≈305
//   考試日期： label at imgY=653-668, colon right edge imgX≈305
//   X = 308 * 0.8223 = 253 (just after colon)
//   NAME_Y = 617 * 0.8216 = 507 (align text top with label top)
//   DATE_Y = 653 * 0.8216 = 537 (align text top with label top)
const NAME_X = 253;
const NAME_Y = 507;
const DATE_X = 253;
const DATE_Y = 537;
const FONT_SIZE = 13;

export interface CandidateForSheet {
  id: number;
  name: string;
  currentBelt: string;
  targetBelt: string;
  groupCode?: string;
  orderNumber?: number;
  age?: number;
}

export interface GenerateOptions {
  candidates: CandidateForSheet[];
  examDate: string;       // e.g. "2026-07-12"
  examName?: string;
  outputPath: string;
}

function formatExamDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function getTemplatePath(currentBelt: string): string | null {
  const filename = BELT_TEMPLATE_MAP[currentBelt];
  if (!filename) return null;
  const fullPath = path.join(TEMPLATES_DIR, filename);
  if (fs.existsSync(fullPath)) return fullPath;
  return null;
}

/**
 * Generate a multi-page PDF with one score sheet per candidate.
 * Pages are landscape A4 with template image background + name/date overlay.
 */
export async function generateScoreSheetPdf(options: GenerateOptions): Promise<{ path: string; pages: number; skipped: string[] }> {
  const { candidates, examDate, outputPath } = options;
  const formattedDate = formatExamDate(examDate);
  const skipped: string[] = [];
  let pages = 0;

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    autoFirstPage: false,
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  for (const candidate of candidates) {
    const templatePath = getTemplatePath(candidate.currentBelt);
    if (!templatePath) {
      skipped.push(`${candidate.name} (${candidate.currentBelt})`);
      continue;
    }

    doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
    doc.image(templatePath, 0, 0, { width: 842, height: 595 });
    doc.font(FONT_PATH).fontSize(FONT_SIZE).fillColor('black');
    doc.text(candidate.name, NAME_X, NAME_Y, { width: 160, lineBreak: false });
    doc.text(formattedDate, DATE_X, DATE_Y, { width: 160, lineBreak: false });
    pages++;
  }

  if (pages === 0) {
    doc.addPage();
    doc.font(FONT_PATH).fontSize(16).text('沒有可匯出的成績表', 100, 100);
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve({ path: outputPath, pages, skipped }));
    stream.on('error', reject);
  });
}

export function getAvailableTemplates(): string[] {
  return Object.keys(BELT_TEMPLATE_MAP).filter(belt => getTemplatePath(belt) !== null);
}
