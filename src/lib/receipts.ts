import { Payment, PaymentMethod, User } from '@/domain/types';
import { LocalClient } from '@/lib/context';
import { Reading } from '@/lib/mockData';
import { BRANDING } from '@/config/branding';
import { formatCurrency, formatPeriod } from '@/lib/utils';

// Same client-side max+1 scan as getNextBudgetNumero (presupuestos/page.tsx) — no
// server-side atomic counter, same known collision risk across offline devices.
export function getNextReceiptNumber(payments: Payment[]): string {
  let max = 1000;
  for (const p of payments) {
    const match = /^REC-(\d+)$/.exec(p.receiptNumber || '');
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return 'REC-' + (max + 1);
}

export function buildPaymentRecord(params: {
  client: LocalClient;
  reading: Reading | null;
  amount: number;
  method: PaymentMethod;
  date: string;
  invoiceReference?: string;
  notes?: string;
  currentUser: User | null;
  existingPayments: Payment[];
  balanceAfter: number;
}): Payment {
  const { client, reading, amount, method, date, invoiceReference, notes, currentUser, existingPayments, balanceAfter } = params;

  return {
    id: 'pay-' + crypto.randomUUID(),
    receiptNumber: getNextReceiptNumber(existingPayments),
    clientId: client.id,
    readingId: reading ? reading.id : null,
    amount,
    method,
    date,
    invoiceReference: invoiceReference || (reading ? reading.invoiceNumber || null : null),
    receivedByUserId: currentUser?.id || null,
    receivedByName: currentUser?.fullname || currentUser?.username || 'Administrador',
    clientNameSnapshot: client.name,
    clientCuitSnapshot: client.cuit || null,
    period: reading ? reading.month : 'Ajuste de saldo',
    concept: reading ? `Abono y excedente período ${reading.month}` : 'Ajuste manual de saldo',
    readingTotalSnapshot: reading ? Number(reading.totalAmount) || 0 : null,
    balanceAfter,
    notes: notes || null,
  };
}

// Modeled directly on printClientAccount (clientes/page.tsx): window.open + raw HTML
// + window.print() on load. No PDF library — the user chooses "Guardar como PDF" in
// the browser's own print dialog if they need a file, same as the account statement.
export function generateReceiptHtml(payment: Payment): string {
  const isPartial = payment.balanceAfter > 0.01;
  const statusLabel = isPartial
    ? `PAGO PARCIAL — Resta ${formatCurrency(payment.balanceAfter)}`
    : 'PAGO TOTAL — Saldo Cancelado';
  const statusColor = isPartial ? '#b45309' : '#047857';
  const statusBg = isPartial ? '#fef3c7' : '#ecfdf5';

  return `
    <html>
        <head>
            <title>Recibo ${payment.receiptNumber} - ${payment.clientNameSnapshot}</title>
            <style>
                body { font-family: Arial, sans-serif; color: #334155; padding: 30px; line-height: 1.5; }
                .header-box { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; }
                .recibo-box { border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 24px; overflow: hidden; }
                .recibo-row { display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
                .recibo-row:last-child { border-bottom: none; }
                .label { color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 10px; }
                .amount-box { text-align: center; margin-top: 24px; padding: 20px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; }
                .footer-signature { margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
            </style>
        </head>
        <body>
            <div class="header-box">
                <div>
                    <h2 style="margin: 0; color: #4f46e5; font-size: 22px;">${BRANDING.legalName}</h2>
                    <span style="font-size: 11px; color: #64748b;">CUIT: ${BRANDING.cuit} | ${BRANDING.address}, ${BRANDING.city}</span><br/>
                    <span style="font-size: 11px; color: #64748b;">${BRANDING.email} | Tel: ${BRANDING.phones}</span>
                </div>
                <div style="text-align: right;">
                    <h3 style="margin: 0; font-size: 16px; text-transform: uppercase;">Recibo de Pago</h3>
                    <span style="font-size: 14px; font-weight: bold; color: #4f46e5;">N° ${payment.receiptNumber}</span><br/>
                    <span style="font-size: 10px; color: #64748b;">Fecha: ${payment.date}</span>
                </div>
            </div>

            <div class="recibo-box">
                <div class="recibo-row">
                    <div><span class="label">Recibí de</span><br/><strong>${payment.clientNameSnapshot}</strong></div>
                    <div style="text-align: right;"><span class="label">CUIT</span><br/>${payment.clientCuitSnapshot || 'N/A'}</div>
                </div>
                <div class="recibo-row">
                    <div><span class="label">Concepto</span><br/>${payment.concept || '-'}</div>
                    <div style="text-align: right;"><span class="label">Período</span><br/>${payment.period && payment.period !== 'Ajuste de saldo' ? formatPeriod(payment.period) : (payment.period || '-')}</div>
                </div>
                <div class="recibo-row">
                    <div><span class="label">Método de pago</span><br/>${payment.method}</div>
                    <div style="text-align: right;"><span class="label">N° Factura/Comprobante</span><br/>${payment.invoiceReference || 'Sin comprobante'}</div>
                </div>
                ${payment.readingTotalSnapshot != null ? `
                <div class="recibo-row">
                    <div><span class="label">Importe Total Facturado</span><br/>${formatCurrency(payment.readingTotalSnapshot)}</div>
                    <div style="text-align: right;"><span class="label">Saldo Restante</span><br/>${formatCurrency(Math.max(0, payment.balanceAfter))}</div>
                </div>
                ` : ''}
                ${payment.notes ? `
                <div class="recibo-row">
                    <div style="width: 100%;"><span class="label">Observaciones</span><br/>${payment.notes}</div>
                </div>
                ` : ''}
            </div>

            <div class="amount-box">
                <span class="label">Monto Abonado</span>
                <div style="font-size: 32px; font-weight: bold; color: #1e293b; margin-top: 6px;">${formatCurrency(payment.amount)}</div>
                <div style="margin-top: 10px;">
                    <span style="padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: bold; background-color: ${statusBg}; color: ${statusColor};">${statusLabel}</span>
                </div>
            </div>

            <div class="footer-signature">
                <div>
                    <span>Generado por: ${BRANDING.commercialName}</span><br/>
                    <span>Cobrado por: ${payment.receivedByName}</span>
                </div>
                <div style="text-align: right; margin-top: 20px;">
                    <div style="border-top: 1px solid #64748b; width: 180px; padding-top: 4px; text-align: center;">
                        Firma Autorizada y Sello
                    </div>
                </div>
            </div>

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
    </html>
  `;
}

export function printReceipt(payment: Payment): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(generateReceiptHtml(payment));
  printWindow.document.close();
}
