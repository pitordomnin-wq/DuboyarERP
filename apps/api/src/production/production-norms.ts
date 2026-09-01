import {
  LayoutMaterialRole,
  LkpMaterialCategory,
  ProductionReleaseType,
  StageInputMode,
  StageQuantityBasis,
} from '@prisma/client';
import { roundQty } from '../warehouse/stock-lots';

export const DEFAULT_LKP_NORMS: { category: LkpMaterialCategory; normPerM2Kg: number; keywords: string[] }[] = [
  { category: 'PASTE', normPerM2Kg: 0.005, keywords: ['паста'] },
  { category: 'LACQUER_OIL', normPerM2Kg: 0.015, keywords: ['лак', 'масло'] },
  { category: 'DYE', normPerM2Kg: 0.005, keywords: ['краситель', 'морилк'] },
  { category: 'PIGMENT', normPerM2Kg: 0.003, keywords: ['пигмент'] },
  { category: 'PRIMER', normPerM2Kg: 0.05, keywords: ['грунт', 'грунтовк', 'изолятор'] },
];

export const LKP_CATEGORY_LABEL: Record<LkpMaterialCategory, string> = {
  PRIMER: 'Грунт',
  LACQUER_OIL: 'Лак / масло',
  PASTE: 'Паста',
  DYE: 'Краситель',
  PIGMENT: 'Пигмент',
};

export const RELEASE_TYPE_LABEL: Record<ProductionReleaseType, string> = {
  DECK: 'Палуба',
  HERRINGBONE: 'Ёлка',
};

const HERRINGBONE_HINTS = ['ёлоч', 'елоч', 'елка', 'herringbone', 'her'];

export function inferReleaseType(productName: string, fallback: ProductionReleaseType = 'DECK'): ProductionReleaseType {
  const lower = productName.toLowerCase();
  return HERRINGBONE_HINTS.some((hint) => lower.includes(hint)) ? 'HERRINGBONE' : fallback;
}

export function parseKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

export function matchesKeywords(name: string, keywords: string[]): boolean {
  if (!keywords.length) return false;
  const lower = name.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

export function computeEffectiveM2(quantityM2: number, lossPercent: number): number {
  return roundQty(quantityM2 * Math.max(0, 1 - lossPercent / 100));
}

export function computePieceCount(quantityM2: number, lossPercent: number, piecesPerM2: number): number {
  const factor = Math.max(0, 1 - lossPercent / 100);
  return roundQty(quantityM2 * factor * piecesPerM2);
}

export function computePackageCount(
  quantityM2: number,
  lossPercent: number,
  releaseType: ProductionReleaseType,
  m2PerPackageDeck: number,
  m2PerPackageHerringbone: number,
): number {
  const factor = Math.max(0, 1 - lossPercent / 100);
  const effectiveM2 = quantityM2 * factor;
  const m2PerPackage = releaseType === 'HERRINGBONE' ? m2PerPackageHerringbone : m2PerPackageDeck;
  if (m2PerPackage <= 0) return 0;
  return Math.max(1, Math.ceil(effectiveM2 / m2PerPackage - 1e-9));
}

type JobQuantities = {
  quantityM2: number;
  pieceCount: number | null;
  packageCount: number | null;
};

type TypeQuantities = {
  piecesPerM2: number;
  m2PerPackageDeck: number;
  m2PerPackageHerringbone: number;
};

export function resolveBasisQuantity(
  basis: StageQuantityBasis,
  job: JobQuantities,
  profilingLossPercent: number,
  type: TypeQuantities,
  releaseType: ProductionReleaseType,
): number {
  switch (basis) {
    case 'M2_ORIGINAL':
      return computeEffectiveM2(job.quantityM2, profilingLossPercent);
    case 'M2':
      return job.quantityM2;
    case 'PIECE':
      return (
        job.pieceCount ??
        computePieceCount(job.quantityM2, profilingLossPercent, type.piecesPerM2)
      );
    case 'PACKAGE':
      return (
        job.packageCount ??
        computePackageCount(
          job.quantityM2,
          profilingLossPercent,
          releaseType,
          type.m2PerPackageDeck,
          type.m2PerPackageHerringbone,
        )
      );
    default:
      return job.quantityM2;
  }
}

export function defaultQuantityBasis(stagePosition: number, inputMode: StageInputMode): StageQuantityBasis {
  if (inputMode === 'LKP_RECIPE') return 'M2_ORIGINAL';
  if (stagePosition >= 3) return 'PACKAGE';
  if (stagePosition >= 2) return 'PIECE';
  return 'M2';
}

export function layoutKeywords(role: LayoutMaterialRole): string[] {
  switch (role) {
    case 'VENEER_OAK':
      return ['шпон дуб'];
    case 'VENEER_DECK':
      return ['шпон', '1400', '155'];
    case 'VENEER_HERRINGBONE':
      return ['шпон', '690', '130'];
    case 'BOX_DECK':
      return ['короб', 'т24', '1400'];
    case 'BOX_HERRINGBONE':
      return ['короб', 'т23', '700'];
    case 'PACK_UNIVERSAL':
      return ['гофрокартон', 'листовк', 'наклейк'];
    default:
      return [];
  }
}

export function layoutRoleForRelease(role: LayoutMaterialRole, releaseType: ProductionReleaseType): boolean {
  if (role === 'VENEER_OAK' || role === 'PACK_UNIVERSAL') return true;
  if (releaseType === 'DECK') return role === 'VENEER_DECK' || role === 'BOX_DECK';
  return role === 'VENEER_HERRINGBONE' || role === 'BOX_HERRINGBONE';
}
