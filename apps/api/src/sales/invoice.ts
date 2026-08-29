function money(value: number) {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dash(value?: string | null) {
  return value?.trim() || '—';
}

type InvoiceInput = {
  number: string;
  date: Date;
  seller: {
    name: string;
    inn?: string | null;
    kpp?: string | null;
    ogrn?: string | null;
    legalAddress?: string | null;
    bankName?: string | null;
    bik?: string | null;
    checkingAccount?: string | null;
    correspondentAccount?: string | null;
  };
  buyer: {
    legalName: string;
    inn: string;
    kpp?: string | null;
    legalAddress: string;
  };
  items: { name: string; quantity: number; unit: string; price: number }[];
};

export function buildInvoiceHtml(input: InvoiceInput) {
  const rows = input.items.map((item, index) => {
    const sum = item.quantity * item.price;
    return `<tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${item.quantity}</td>
      <td>${escapeHtml(item.unit)}</td>
      <td class="num">${money(item.price)}</td>
      <td class="num">${money(sum)}</td>
    </tr>`;
  });
  const total = input.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const vat = Math.round(total * 20) / 100;
  const date = input.date.toLocaleDateString('ru-RU');

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Счёт ${escapeHtml(input.number)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; width: 210mm; margin: 0 auto; padding: 16px; }
    table { border-collapse: collapse; width: 100%; }
    .bank td { border: 1px solid #111; padding: 4px 6px; }
    .items th, .items td { border: 1px solid #111; padding: 4px 6px; }
    .items th { background: #f3f3f3; }
    .num { text-align: right; white-space: nowrap; }
    h1 { font-size: 16px; margin: 18px 0 10px; }
    .muted { color: #444; }
  </style>
</head>
<body>
  <table class="bank">
    <tr>
      <td colspan="2">Банк получателя<br><b>${escapeHtml(dash(input.seller.bankName))}</b></td>
      <td>БИК</td>
      <td>${escapeHtml(dash(input.seller.bik))}</td>
    </tr>
    <tr>
      <td>ИНН ${escapeHtml(dash(input.seller.inn))}</td>
      <td>КПП ${escapeHtml(dash(input.seller.kpp))}</td>
      <td>Сч. №</td>
      <td>${escapeHtml(dash(input.seller.checkingAccount))}</td>
    </tr>
    <tr>
      <td colspan="2">Получатель<br><b>${escapeHtml(input.seller.name)}</b></td>
      <td>Корр. сч.</td>
      <td>${escapeHtml(dash(input.seller.correspondentAccount))}</td>
    </tr>
  </table>
  <h1>Счёт на оплату № ${escapeHtml(input.number)} от ${date}</h1>
  <p><b>Поставщик:</b> ${escapeHtml(input.seller.name)}, ИНН ${escapeHtml(dash(input.seller.inn))}, ${escapeHtml(dash(input.seller.legalAddress))}</p>
  <p><b>Покупатель:</b> ${escapeHtml(input.buyer.legalName)}, ИНН ${escapeHtml(input.buyer.inn)}${input.buyer.kpp ? `, КПП ${escapeHtml(input.buyer.kpp)}` : ''}, ${escapeHtml(input.buyer.legalAddress)}</p>
  <table class="items">
    <thead>
      <tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Ед.</th><th>Цена</th><th>Сумма</th></tr>
    </thead>
    <tbody>${rows.join('')}</tbody>
  </table>
  <p class="num"><b>Итого: ${money(total)} ₽</b><br>в т.ч. НДС 20%: ${money(vat)} ₽</p>
  <p class="muted">Документ сформирован в Faverum. Подпись и печать при необходимости добавляются при печати.</p>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
