import type { UpdDocumentInput } from './upd-cells';

function money(value: number) {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

/** Official-looking UPD HTML (status 1), used for browser preview and Chrome PDF. */
export function buildUpdHtml(input: UpdDocumentInput): string {
  const date = input.date.toLocaleDateString('ru-RU');
  const total = input.lines.reduce((sum, line) => sum + line.quantity * line.price, 0);
  const rows = input.lines
    .map((line, index) => {
      const sum = line.quantity * line.price;
      return `<tr>
        <td class="c">${index + 1}</td>
        <td>${esc(lineLabel(line))}</td>
        <td class="c">—</td>
        <td class="c">${esc(line.unit || 'шт')}</td>
        <td class="n">${line.quantity}</td>
        <td class="n">${money(line.price)}</td>
        <td class="n">${money(sum)}</td>
        <td class="c">без акциза</td>
        <td class="c">без НДС</td>
        <td class="c">—</td>
        <td class="n">${money(sum)}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>УПД ${esc(input.number)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Arial Unicode MS", Arial, "DejaVu Sans", sans-serif;
      font-size: 10px;
      color: #111;
      margin: 0;
      padding: 12px;
      background: #fff;
    }
    h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
    .meta { text-align: center; margin-bottom: 10px; font-size: 11px; }
    .grid { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .grid th, .grid td { border: 1px solid #111; padding: 3px 5px; vertical-align: top; }
    .grid th { background: #f3f3f3; font-weight: 600; text-align: center; }
    .label { width: 160px; background: #f7f7f7; white-space: nowrap; }
    .c { text-align: center; }
    .n { text-align: right; white-space: nowrap; }
    .items { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .items th, .items td { border: 1px solid #111; padding: 3px 4px; font-size: 9px; }
    .items th { background: #f3f3f3; }
    .sign { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .sign td { border: 1px solid #111; padding: 6px 8px; height: 42px; vertical-align: top; }
    .muted { color: #444; font-size: 9px; }
    .total-row td { font-weight: 700; }
  </style>
</head>
<body>
  <h1>Универсальный передаточный документ</h1>
  <div class="meta">
    <div>УПД № <b>${esc(input.number)}</b> от <b>${esc(date)}</b></div>
    <div>Статус: <b>${input.status ?? 1}</b> — счёт-фактура и передаточный документ (акт)</div>
  </div>

  <table class="grid">
    <tr><td class="label">Продавец (2)</td><td>${esc(input.seller.name)}</td></tr>
    <tr><td class="label">Адрес (2а)</td><td>${esc(input.seller.address?.trim() || '—')}</td></tr>
    <tr><td class="label">ИНН/КПП продавца (2б)</td><td>${esc(innKpp(input.seller))}</td></tr>
    <tr><td class="label">Грузоотправитель (3)</td><td>${esc([input.seller.name, input.seller.address?.trim()].filter(Boolean).join(', ') || '—')}</td></tr>
    <tr><td class="label">Грузополучатель (4)</td><td>${esc([input.buyer.name, input.buyer.address?.trim()].filter(Boolean).join(', ') || '—')}</td></tr>
    <tr><td class="label">Покупатель (6)</td><td>${esc(input.buyer.name)}</td></tr>
    <tr><td class="label">Адрес (6а)</td><td>${esc(input.buyer.address?.trim() || '—')}</td></tr>
    <tr><td class="label">ИНН/КПП покупателя (6б)</td><td>${esc(innKpp(input.buyer))}</td></tr>
    <tr><td class="label">Валюта (7)</td><td>Российский рубль, 643</td></tr>
    <tr><td class="label">Основание передачи (8)</td><td>${esc(input.basis)}</td></tr>
    <tr><td class="label">Документ об отгрузке (5а)</td><td>УПД № ${esc(input.number)} от ${esc(date)}</td></tr>
  </table>

  <table class="items">
    <thead>
      <tr>
        <th>№<br/>п/п<br/>(1)</th>
        <th>Наименование товара<br/>(1а)</th>
        <th>Код вида<br/>товара<br/>(1б)</th>
        <th>Ед.<br/>(2а)</th>
        <th>Кол-во<br/>(3)</th>
        <th>Цена<br/>(4)</th>
        <th>Стоимость<br/>без налога<br/>(5)</th>
        <th>Акциз<br/>(6)</th>
        <th>Налоговая<br/>ставка<br/>(7)</th>
        <th>Сумма<br/>налога<br/>(8)</th>
        <th>Стоимость<br/>с налогом<br/>(9)</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="6" class="n">Всего к оплате</td>
        <td class="n">${money(total)}</td>
        <td class="c" colspan="2">X</td>
        <td class="c">—</td>
        <td class="n">${money(total)}</td>
      </tr>
    </tbody>
  </table>

  <table class="sign">
    <tr>
      <td style="width:50%">
        <div class="muted">Товар (груз) передал / услуги, результаты работ, права сдал</div>
        <div style="margin-top:8px">${esc(input.signerTitle)}</div>
        <div>${esc(input.signerName)}</div>
        <div class="muted" style="margin-top:8px">Дата отгрузки: ${esc(date)}</div>
      </td>
      <td style="width:50%">
        <div class="muted">Ответственный за правильность оформления факта хозяйственной жизни</div>
        <div style="margin-top:8px">${esc(input.signerTitle)}</div>
        <div>${esc(input.signerName)}</div>
        <div class="muted" style="margin-top:8px">Наименование экономического субъекта — составителя документа</div>
        <div>${esc(input.seller.name)}, ИНН/КПП ${esc(innKpp(input.seller))}</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
