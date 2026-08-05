'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useManagement, LocalClient } from '@/lib/context';
import { Reading } from '@/lib/mockData';
import { PAYMENT_METHODS, PaymentMethod } from '@/domain/types';
import { formatCurrency, getClientFinancialSummaryHelper, playSystemSound } from '@/lib/utils';
import { buildPaymentRecord, printReceipt } from '@/lib/receipts';

export interface RegisterPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: LocalClient | null;
  // null = paying against the client's manual balance ("Ajuste"), not a specific reading
  reading: Reading | null;
  pendingAmount: number;
}

export const RegisterPaymentModal: React.FC<RegisterPaymentModalProps> = ({ isOpen, onClose, client, reading, pendingAmount }) => {
  const { readings, machines, payments, currentUser, cobranzaConfig, addReadingAction, addPaymentAction, addGestionAction, updateClientAction } = useManagement();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('Efectivo');
  const [date, setDate] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount(pendingAmount > 0 ? String(pendingAmount) : '');
      setMethod('Efectivo');
      setDate(new Date().toISOString().split('T')[0]);
      setInvoiceReference((reading as any)?.invoiceNumber || '');
      setNotes('');
      setError(null);
    }
  }, [isOpen, pendingAmount, reading]);

  if (!isOpen || !client) return null;

  const alreadyPaid = reading ? Number(reading.paymentAmount) || 0 : 0;

  const handleConfirm = () => {
    setError(null);
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Ingresá un monto válido mayor a cero.');
      return;
    }
    // Small epsilon tolerance for floating point comparisons on currency values.
    if (parsedAmount > pendingAmount + 0.01) {
      setError(`El monto no puede superar el saldo pendiente de ${formatCurrency(pendingAmount)}.`);
      return;
    }
    if (!date) {
      setError('Seleccioná una fecha de cobro.');
      return;
    }

    const balanceAfter = Math.max(0, pendingAmount - parsedAmount);

    // Apply the payment to its source (a reading's billing/collection status, or the
    // client's manual balance) BEFORE building the receipt record and gestion log, so
    // both reflect the post-payment state.
    let updatedReadingsForSummary = readings;
    let clientForSummary: LocalClient = client;

    if (reading) {
      const newPaymentAmount = Math.min(Number(reading.totalAmount) || 0, alreadyPaid + parsedAmount);
      const totalAmt = Number(reading.totalAmount) || 0;
      const newStatus: 'Impago' | 'Parcial' | 'Pagado' =
        newPaymentAmount >= totalAmt - 0.01 ? 'Pagado' : (newPaymentAmount > 0 ? 'Parcial' : 'Impago');

      const updatedReading: Reading = {
        ...reading,
        collectionStatus: newStatus,
        paymentAmount: newPaymentAmount,
        paymentDate: date,
      };
      addReadingAction(updatedReading, undefined, 'update');
      updatedReadingsForSummary = readings.map(r => r.id === reading.id ? updatedReading : r);
    } else {
      const newDebt = Math.max(0, (client.debt || 0) - parsedAmount);
      clientForSummary = { ...client, debt: newDebt };
      updateClientAction(clientForSummary, 'update');
    }

    const paymentRecord = buildPaymentRecord({
      client,
      reading,
      amount: parsedAmount,
      method,
      date,
      invoiceReference,
      notes,
      currentUser,
      existingPayments: payments,
      balanceAfter,
    });
    addPaymentAction(paymentRecord, 'create');

    // Same Regularización-vs-Pago-registrado branching handleCollectInvoice already
    // used — based on the CLIENT'S overall account balance after this payment, not
    // just whether this one reading/ajuste was fully settled.
    const nextSummary = getClientFinancialSummaryHelper(clientForSummary, updatedReadingsForSummary, machines);
    const fullyRegularized = nextSummary.saldo <= 0.01;
    const collectorName = currentUser?.fullname || currentUser?.username || 'Administrador';
    const concept = reading ? `período ${reading.month}` : 'ajuste de saldo';

    if (fullyRegularized) {
      addGestionAction({
        id: `g-${crypto.randomUUID()}`,
        clientId: client.id,
        date,
        type: 'Regularización',
        user: collectorName,
        channel: 'Sistema',
        result: 'Regularizado',
        observations: `Pago de ${concept} (Recibo ${paymentRecord.receiptNumber}) cancelando saldo total.`,
      }, 'create');
    } else {
      addGestionAction({
        id: `g-${crypto.randomUUID()}`,
        clientId: client.id,
        date,
        type: 'Pago registrado',
        user: collectorName,
        channel: 'Sistema',
        result: balanceAfter > 0.01 ? 'Cobrado parcial' : 'Cobrado',
        observations: `Pago de ${concept} (Recibo ${paymentRecord.receiptNumber}) por ${formatCurrency(parsedAmount)}.`,
      }, 'create');
    }

    playSystemSound(fullyRegularized ? 'regularizado' : 'pago', cobranzaConfig);
    printReceipt(paymentRecord);
    alert(`Cobro registrado con éxito. Recibo ${paymentRecord.receiptNumber} generado.`);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Cobro"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleConfirm}>Confirmar y Emitir Recibo</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-xs bg-slate-950/40 p-3 rounded-xl border border-slate-850/60 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Cliente</span>
            <span className="font-bold text-slate-100">{client.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Saldo pendiente</span>
            <span className="font-bold text-slate-100">{formatCurrency(pendingAmount)}</span>
          </div>
          {alreadyPaid > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Ya cobrado en este comprobante</span>
              <span className="font-semibold text-emerald-400">{formatCurrency(alreadyPaid)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t border-slate-800/50">
            <span className="text-slate-400">Cobrado por</span>
            <span className="font-semibold text-slate-200">{currentUser?.fullname || currentUser?.username || 'Administrador'}</span>
          </div>
        </div>

        <Input
          label="Monto a Cobrar *"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />

        <Select
          label="Método de Pago *"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
        />

        <Input
          label="Fecha de Cobro *"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <Input
          label="N° de Factura / Comprobante"
          value={invoiceReference}
          onChange={(e) => setInvoiceReference(e.target.value)}
          placeholder="Opcional"
        />

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Observaciones</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Opcional"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs font-semibold rounded-lg">
            ⚠️ {error}
          </div>
        )}
      </div>
    </Modal>
  );
};
