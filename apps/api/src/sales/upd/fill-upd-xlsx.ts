import { existsSync } from 'fs';
import { join } from 'path';
import ExcelJS from 'exceljs';
import {
  MONTHS_RU,
  UPD_CELLS,
  UPD_LINE_START_ROWS,
  UPD_SHEET,
  UPD_TOTALS_ROW,
  type UpdDocumentInput,
} from './upd-cells';

function blankPath() {
  const candidates = [
    join(__dirname, '..', '..', '..', 'assets', 'upd-blank-2026.xlsx'),
    join(__dirname, '..', '..', 'assets', 'upd-blank-2026.xlsx'),
    join(process.cwd(), 'assets', 'upd-blank-2026.xlsx'),
    join(process.cwd(), 'apps', 'api', 'assets', 'upd-blank-2026.xlsx'),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error('upd_blank_missing');
  return found;
}

function innKpp(party: { inn?: string | null; kpp?: string | null }) {
  const inn = party.inn?.trim();
  const kpp = party.kpp?.trim();
  if (inn && kpp) return `${inn} / ${kpp}`;
  return inn || '—';
}

function lineLabel(line: UpdDocumentInput['lines'][number]) {
  const sku = line.sku?.trim();
  return sku ? `${sku} · ${line.name}` : line.name;
}

function setCell(ws: ExcelJS.Worksheet, address: string, value: string | number) {
  ws.getCell(address).value = value;
}

function addLineMerges(ws: ExcelJS.Worksheet, start: number) {
  const end = start + 2;
  const ranges = [
    `A${start}:S${end}`,
    `T${start}:X${end}`,
    `Y${start}:AI${end}`,
    `AJ${start}:AN${end}`,
    `AO${start}:AS${end}`,
    `AT${start}:BG${end}`,
    `BH${start}:BN${end}`,
    `BO${start}:BU${end}`,
    `BV${start}:CD${end}`,
    `CE${start}:CI${end}`,
    `CJ${start}:CN${end}`,
    `CO${start}:CU${end}`,
    `CV${start}:DD${end}`,
    `DE${start}:DJ${end}`,
    `DK${start}:DS${end}`,
  ];
  for (const range of ranges) {
    try {
      ws.mergeCells(range);
    } catch {
      // ignore already-merged
    }
  }
}

function writeLine(ws: ExcelJS.Worksheet, start: number, index: number, line: UpdDocumentInput['lines'][number]) {
  const sum = Math.round(line.quantity * line.price * 100) / 100;
  setCell(ws, `T${start}`, index + 1);
  setCell(ws, `Y${start}`, lineLabel(line));
  setCell(ws, `AT${start}`, line.unit || 'шт');
  setCell(ws, `BH${start}`, line.quantity);
  setCell(ws, `BO${start}`, line.price);
  setCell(ws, `BV${start}`, sum);
  setCell(ws, `CE${start}`, 'без акциза');
  setCell(ws, `CJ${start}`, 'без НДС');
  setCell(ws, `CO${start}`, '—');
  setCell(ws, `CV${start}`, sum);
}

export async function fillUpdXlsx(input: UpdDocumentInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(blankPath());
  const ws = workbook.getWorksheet(UPD_SHEET);
  if (!ws) throw new Error('upd_sheet_missing');

  const date = input.date;
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS_RU[date.getMonth()];
  const year = String(date.getFullYear());
  const dateRu = `${day}.${String(date.getMonth() + 1).padStart(2, '0')}.${year}`;

  const extraBlocks = Math.max(0, input.lines.length - UPD_LINE_START_ROWS.length);
  if (extraBlocks > 0) {
    for (let i = 0; i < extraBlocks; i++) {
      ws.spliceRows(UPD_TOTALS_ROW, 0, [], [], []);
      addLineMerges(ws, UPD_TOTALS_ROW);
    }
  }
  const shift = extraBlocks * 3;
  const totalsRow = UPD_TOTALS_ROW + shift;

  setCell(ws, UPD_CELLS.number, input.number);
  setCell(ws, UPD_CELLS.day, day);
  setCell(ws, UPD_CELLS.month, month);
  setCell(ws, UPD_CELLS.year, year);
  setCell(ws, UPD_CELLS.status, input.status ?? 1);

  setCell(ws, UPD_CELLS.sellerName, input.seller.name);
  setCell(ws, UPD_CELLS.sellerAddress, input.seller.address?.trim() || '—');
  setCell(ws, UPD_CELLS.sellerInnKpp, innKpp(input.seller));

  const sellerLine = [input.seller.name, input.seller.address?.trim()].filter(Boolean).join(', ');
  const buyerLine = [input.buyer.name, input.buyer.address?.trim()].filter(Boolean).join(', ');
  setCell(ws, 'AV12', sellerLine || '—');
  setCell(ws, 'AU13', buyerLine || '—');
  setCell(ws, 'BF15', `УПД № ${input.number}`);
  setCell(ws, 'CJ15', dateRu);

  setCell(ws, UPD_CELLS.buyerName, input.buyer.name);
  setCell(ws, UPD_CELLS.buyerAddress, input.buyer.address?.trim() || '—');
  setCell(ws, UPD_CELLS.buyerInnKpp, innKpp(input.buyer));
  setCell(ws, UPD_CELLS.currency, 'Российский рубль, 643');

  let total = 0;
  for (let i = 0; i < input.lines.length; i++) {
    const start = 31 + i * 3;
    writeLine(ws, start, i, input.lines[i]);
    total += Math.round(input.lines[i].quantity * input.lines[i].price * 100) / 100;
  }
  total = Math.round(total * 100) / 100;

  setCell(ws, `CE${totalsRow}`, total);
  try {
    setCell(ws, `CV${totalsRow}`, total);
  } catch {
    // optional
  }

  setCell(ws, `B${45 + shift}`, input.basis);
  setCell(ws, `B${56 + shift}`, input.signerTitle);
  setCell(ws, `AY${51 + shift}`, input.signerName);
  setCell(ws, `AY${57 + shift}`, input.signerName);
  setCell(ws, `AI${52 + shift}`, day);
  setCell(ws, `AO${52 + shift}`, month);
  setCell(ws, `BP${52 + shift}`, year.slice(2));

  // Keep official blank print settings so LibreOffice PDF matches Excel print layout.
  ws.pageSetup = {
    ...ws.pageSetup,
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    printArea: `A1:GL${62 + shift}`,
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
