/** Cell map for official UPD blank 2026 (sheet «стр.1_2»). */

export const UPD_SHEET = 'стр.1_2';

export const UPD_CELLS = {
  number: 'BR7',
  day: 'CC7',
  month: 'CH7',
  year: 'CP7',
  status: 'I12',
  sellerName: 'AD9',
  sellerAddress: 'AA10',
  sellerInnKpp: 'AN11',
  consignor: 'AV12', // start of cargo shipper merge — write into T12 area value cells
  consignee: 'AV13',
  shipmentDoc: 'DP15',
  buyerName: 'AF21',
  buyerAddress: 'AA22',
  buyerInnKpp: 'AP23',
  currency: 'AH26',
  basis: 'B45',
  signerTitle: 'B56',
  handedTitle: 'B56',
  handedName: 'AY51',
  responsibleName: 'AY57',
  shipDay: 'AI52',
  shipMonth: 'AO52',
  shipYear: 'BP52',
} as const;

/** First data row of each 3-row product block in the blank (2 slots before totals). */
export const UPD_LINE_START_ROWS = [31, 34] as const;

/** Totals row in the blank before any inserted lines. */
export const UPD_TOTALS_ROW = 37;

export const MONTHS_RU = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

export type UpdLineInput = {
  name: string;
  sku?: string | null;
  unit: string;
  quantity: number;
  price: number;
};

export type UpdParty = {
  name: string;
  address?: string | null;
  inn?: string | null;
  kpp?: string | null;
};

export type UpdDocumentInput = {
  number: string;
  date: Date;
  status?: 1 | 2;
  seller: UpdParty;
  buyer: UpdParty;
  basis: string;
  signerName: string;
  signerTitle: string;
  lines: UpdLineInput[];
};
