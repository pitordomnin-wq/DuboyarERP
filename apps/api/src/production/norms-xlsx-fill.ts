import * as XLSX from 'xlsx';

const THEME_COLOR_ORDER = [
  'lt1',
  'dk1',
  'lt2',
  'dk2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hlink',
  'folHlink',
] as const;

const STATIC_FILL_LABELS: Record<string, string> = {
  FFFF00: 'ЛКП: Прочее',
  '8DB3E2': 'Клеи',
  FABF8F: 'ХДФ',
  '00B050': 'Упаковка',
  C27BA0: 'Шпон дуб',
  B6DDE8: 'Шпон берёза',
};

const CF_RULE_LABELS: Record<string, string> = {
  паста: 'ЛКП: Паста',
  лак: 'ЛКП: Лак',
  масло: 'ЛКП: Масло',
  пигмент: 'ЛКП: Пигмент',
  краситель: 'ЛКП: Краситель',
  грунт: 'ЛКП: Грунт',
};

const CF_DXF_LABELS: Record<string, string> = {
  FFEB9C: 'ЛКП: Паста',
  FFC7CE: 'ЛКП: Лак',
  C6EFCE: 'ЛКП: Масло',
  FFFFFF: 'ЛКП: Пигмент',
  '4BACC6': 'ЛКП: Грунт',
};

type CfRule = {
  priority: number;
  dxfId: number;
  text: string;
};

type XlsxBookFileEntry = { content?: Buffer | Uint8Array | string };
type XlsxBookFiles = Record<string, XlsxBookFileEntry | undefined>;

function readXlsxPart(files: XlsxBookFiles, path: string): string {
  const entry = files[path];
  if (!entry?.content) {
    throw new Error(`Missing xlsx part: ${path}`);
  }
  return Buffer.from(entry.content).toString('utf8');
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractThemeColors(themeXml: string): Record<number, string> {
  const colors: Record<number, string> = {};
  for (let index = 0; index < THEME_COLOR_ORDER.length; index += 1) {
    const tag = THEME_COLOR_ORDER[index];
    const block = themeXml.match(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'i'))?.[0];
    if (!block) continue;
    const rgb =
      block.match(/<a:srgbClr val="([A-Fa-f0-9]{6})"/i)?.[1] ??
      block.match(/<a:sysClr[^>]*lastClr="([A-Fa-f0-9]{6})"/i)?.[1];
    if (rgb) colors[index] = rgb.toUpperCase();
  }
  return colors;
}

function resolveColorTag(tag: string, themeColors: Record<number, string>): string | null {
  const rgb = tag.match(/rgb="([A-Fa-f0-9]{8})"/i)?.[1];
  if (rgb) return rgb.slice(-6).toUpperCase();
  const theme = tag.match(/theme="(\d+)"/i)?.[1];
  if (theme != null) return themeColors[Number(theme)] ?? null;
  return null;
}

function extractBlock(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match?.[1] ?? '';
}

function extractStaticFills(stylesXml: string, themeColors: Record<number, string>): (string | null)[] {
  const fillsBlock = extractBlock(stylesXml, 'fills');
  const fills: (string | null)[] = [];
  for (const block of fillsBlock.match(/<fill>[\s\S]*?<\/fill>/g) ?? []) {
    const fg = block.match(/<fgColor[^>]*\/>/)?.[0] ?? block.match(/<fgColor[^>]*>[\s\S]*?<\/fgColor>/)?.[0];
    fills.push(fg ? resolveColorTag(fg, themeColors) : null);
  }
  return fills;
}

function extractDxfColors(stylesXml: string, themeColors: Record<number, string>): (string | null)[] {
  const dxfsBlock = extractBlock(stylesXml, 'dxfs');
  const colors: (string | null)[] = [];
  for (const block of dxfsBlock.match(/<dxf>[\s\S]*?<\/dxf>/g) ?? []) {
    const bg = block.match(/<bgColor[^>]*\/>/)?.[0] ?? block.match(/<bgColor[^>]*>[\s\S]*?<\/bgColor>/)?.[0];
    const fg = block.match(/<fgColor[^>]*\/>/)?.[0] ?? block.match(/<fgColor[^>]*>[\s\S]*?<\/fgColor>/)?.[0];
    colors.push(resolveColorTag(bg ?? fg ?? '', themeColors));
  }
  return colors;
}

function extractCellFillIds(stylesXml: string): number[] {
  const xfsBlock = extractBlock(stylesXml, 'cellXfs');
  return [...xfsBlock.matchAll(/<xf[^>]*fillId="(\d+)"[^>]*\/?>/g)].map((match) => Number(match[1]));
}

function extractCfRules(sheetXml: string): CfRule[] {
  const rules: CfRule[] = [];
  for (const block of sheetXml.match(/<cfRule[\s\S]*?<\/cfRule>/g) ?? []) {
    const priority = Number(block.match(/priority="(\d+)"/)?.[1] ?? 999);
    const dxfId = Number(block.match(/dxfId="(\d+)"/)?.[1] ?? -1);
    const text = decodeXmlText(block.match(/text="([^"]*)"/)?.[1] ?? '').toLowerCase();
    if (dxfId >= 0 && text) rules.push({ priority, dxfId, text });
  }
  return rules.sort((left, right) => left.priority - right.priority);
}

function extractSharedStrings(sharedStringsXml: string): string[] {
  const values: string[] = [];
  for (const block of sharedStringsXml.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    const parts = [...block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXmlText(match[1]));
    values.push(parts.join(''));
  }
  return values;
}

function readCellValue(cellXml: string, sharedStrings: string[]): string {
  const inline = cellXml.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
  if (inline != null) return decodeXmlText(inline).trim();
  const raw = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (raw == null) return '';
  if (/t="s"/.test(cellXml)) return sharedStrings[Number(raw)]?.trim() ?? '';
  return raw.trim();
}

function extractColumnAStyles(sheetXml: string): Map<number, number> {
  const styles = new Map<number, number>();
  for (const rowBlock of sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const rowNumber = Number(rowBlock.match(/<row[^>]*\br="(\d+)"/)?.[1]);
    if (!rowNumber) continue;
    const cell =
      rowBlock.match(/<c[^>]*\br="A\d+"[^>]*>[\s\S]*?<\/c>/)?.[0] ??
      rowBlock.match(/<c[^>]*\br="A\d+"[^>]*\/>/)?.[0];
    if (!cell) continue;
    const style = cell.match(/\bs="(\d+)"/)?.[1];
    if (style != null) styles.set(rowNumber, Number(style));
  }
  return styles;
}

function effectiveFillColor(
  materialName: string,
  staticRgb: string | null,
  cfRules: CfRule[],
  dxfColors: (string | null)[],
): { rgb: string | null; cfRule: string | null } {
  const lower = materialName.toLowerCase();
  for (const rule of cfRules) {
    if (!lower.includes(rule.text)) continue;
    const cfRgb = dxfColors[rule.dxfId] ?? null;
    return { rgb: cfRgb ?? staticRgb, cfRule: rule.text };
  }
  return { rgb: staticRgb, cfRule: null };
}

export function fillGroupLabel(rgb: string | null, cfRule: string | null): string {
  if (cfRule && CF_RULE_LABELS[cfRule]) return CF_RULE_LABELS[cfRule];
  if (rgb && CF_DXF_LABELS[rgb]) return CF_DXF_LABELS[rgb];
  if (rgb && STATIC_FILL_LABELS[rgb]) return STATIC_FILL_LABELS[rgb];
  if (rgb) return `Заливка #${rgb}`;
  return 'Без заливки';
}

export function fillGroupKey(rgb: string | null, cfRule: string | null): string {
  return `${rgb ?? 'none'}:${cfRule ?? ''}`;
}

export type NormRowFillMeta = {
  fillRgb: string | null;
  fillCfRule: string | null;
  fillGroupKey: string;
  fillGroupName: string;
};

export function readNormRowFillMeta(path: string): Map<string, NormRowFillMeta> {
  const workbook = XLSX.readFile(path, { bookFiles: true, cellStyles: true }) as XLSX.WorkBook & {
    files?: XlsxBookFiles;
  };
  const files = workbook.files;
  if (!files) throw new Error(`Cannot read xlsx internals: ${path}`);

  const stylesXml = readXlsxPart(files, 'xl/styles.xml');
  const sheetXml = readXlsxPart(files, 'xl/worksheets/sheet1.xml');
  const sharedStringsXml = readXlsxPart(files, 'xl/sharedStrings.xml');
  const themeXml = readXlsxPart(files, 'xl/theme/theme1.xml');

  const themeColors = extractThemeColors(themeXml);
  const staticFills = extractStaticFills(stylesXml, themeColors);
  const dxfColors = extractDxfColors(stylesXml, themeColors);
  const cellFillIds = extractCellFillIds(stylesXml);
  const cfRules = extractCfRules(sheetXml);
  const sharedStrings = extractSharedStrings(sharedStringsXml);
  const columnAStyles = extractColumnAStyles(sheetXml);

  const byMaterial = new Map<string, NormRowFillMeta>();

  for (const rowBlock of sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const rowNumber = Number(rowBlock.match(/<row[^>]*\br="(\d+)"/)?.[1]);
    if (!rowNumber || rowNumber < 3) continue;

    const cell =
      rowBlock.match(/<c[^>]*\br="A\d+"[^>]*>[\s\S]*?<\/c>/)?.[0] ??
      rowBlock.match(/<c[^>]*\br="A\d+"[^>]*\/>/)?.[0];
    if (!cell) continue;

    const materialName = readCellValue(cell, sharedStrings);
    if (!materialName) continue;

    const styleIndex = columnAStyles.get(rowNumber) ?? 0;
    const fillId = cellFillIds[styleIndex] ?? 0;
    const staticRgb = staticFills[fillId] ?? null;
    const { rgb, cfRule } = effectiveFillColor(materialName, staticRgb, cfRules, dxfColors);
    const groupName = fillGroupLabel(rgb, cfRule);
    const groupKey = fillGroupKey(rgb, cfRule);

    byMaterial.set(materialName, {
      fillRgb: rgb,
      fillCfRule: cfRule,
      fillGroupKey: groupKey,
      fillGroupName: groupName,
    });
  }

  return byMaterial;
}

export function readNormRowsWithFill<T extends { materialName: string }>(
  path: string,
  rows: T[],
): Array<T & NormRowFillMeta> {
  const fillMeta = readNormRowFillMeta(path);
  return rows.map((row) => {
    const meta = fillMeta.get(row.materialName);
    if (!meta) {
      const fallback = fillGroupLabel(null, null);
      return {
        ...row,
        fillRgb: null,
        fillCfRule: null,
        fillGroupKey: fillGroupKey(null, null),
        fillGroupName: fallback,
      };
    }
    return { ...row, ...meta };
  });
}

export function loadNormRowsFromXlsx(path: string) {
  const workbook = XLSX.readFile(path);
  const sheet = workbook.Sheets['Нормы расхода'] ?? workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });
  const rows = [];
  for (let index = 2; index < matrix.length; index += 1) {
    const row = matrix[index];
    const materialName = String(row?.[0] ?? '').trim();
    const stage = Number(row?.[1]);
    if (!materialName || !stage) continue;
    rows.push({
      materialName,
      stage,
      normDeckM2: row?.[2] != null ? Number(row[2]) : undefined,
      normHerringboneM2: row?.[3] != null ? Number(row[3]) : undefined,
    });
  }
  return readNormRowsWithFill(path, rows);
}
