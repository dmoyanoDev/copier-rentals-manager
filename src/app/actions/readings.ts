'use server';

import { db } from '@/infrastructure/db/client';
import { readings } from '@/infrastructure/db/schema/readings';
import { machines } from '@/infrastructure/db/schema/machines';
import { plans } from '@/infrastructure/db/schema/plans';
import { eq, and } from 'drizzle-orm';
import { auditReading } from '@/domain/reading/audit';
import { calculateBilling } from '@/domain/reading/billing';
import { revalidatePath } from 'next/cache';

export interface ReadingInput {
  id?: string;
  machineId: string;
  month: string;
  initial: number;
  final: number;
  readingStatus: string;
  billingStatus: string;
  collectionStatus: string;
  comments?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  creditNote: number;
  creditNoteReason?: string;
  debitNote: number;
  debitNoteReason?: string;
  invoiceFile?: string;
}

/**
 * Server Action para guardar (crear o editar) una Lectura mensual de un equipo.
 * Aplica auditoría del dominio, calcula costos/excedentes/IVA e incrementa el contador de la máquina.
 */
export async function saveReadingAction(input: ReadingInput) {
  if (input.final < input.initial) {
    return { error: 'La lectura final no puede ser menor a la lectura inicial.' };
  }

  try {
    // 1. Obtener datos de la máquina y abono asociado
    const machineResults = await db.select().from(machines).where(eq(machines.id, input.machineId)).limit(1);
    const machine = machineResults[0];
    if (!machine) return { error: 'Equipo no encontrado.' };

    if (!machine.clientId) return { error: 'El equipo no está asignado a ningún cliente para facturación.' };
    if (!machine.abonoId) return { error: 'El equipo no tiene un plan/abono asignado.' };

    const planResults = await db.select().from(plans).where(eq(plans.id, machine.abonoId)).limit(1);
    const plan = planResults[0];
    if (!plan) return { error: 'Plan/abono no encontrado.' };

    // 2. Obtener historial para la auditoría de consumos promedio
    const historyList = await db
      .select({ initial: readings.initial, final: readings.final })
      .from(readings)
      .where(and(eq(readings.machineId, input.machineId)));

    // 3. Ejecutar la auditoría del dominio (validación de anomalías y reglas de negocio)
    const isUnofficial = input.billingStatus === 'informal' || false;
    const auditAlerts = auditReading({
      initial: input.initial,
      final: input.final,
      limit: plan.limit,
      price: plan.price,
      excessPrice: plan.excessPrice,
      applyIva: machine.applyIva,
      ivaRate: plan.ivaRate,
      isUnofficial,
      creditNote: input.creditNote,
      debitNote: input.debitNote,
      billingStatus: input.billingStatus,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate,
      historicalReadings: historyList,
    });

    // Si existen anomalías de tipo "danger", se detiene la carga
    const hasDanger = auditAlerts.some(a => a.type === 'danger');
    if (hasDanger) {
      return { 
        error: 'No se pudo registrar la lectura debido a anomalías críticas de contadores.', 
        alerts: auditAlerts 
      };
    }

    // 4. Calcular el subtotal y total facturable
    const billing = calculateBilling({
      initial: input.initial,
      final: input.final,
      price: plan.price,
      limit: plan.limit,
      excessPrice: plan.excessPrice,
      applyIva: machine.applyIva,
      ivaRate: plan.ivaRate,
      isUnofficial,
      creditNote: input.creditNote,
      debitNote: input.debitNote,
    });

    // Calcular fecha de vencimiento (10 días después de emitir la factura)
    let dueDate: string | null = null;
    if (input.invoiceDate && (input.billingStatus === 'facturada' || input.billingStatus === 'enviada')) {
      const d = new Date(input.invoiceDate);
      d.setDate(d.getDate() + 10);
      dueDate = d.toISOString().split('T')[0];
    }

    // Bitácora de trazabilidad
    const timelineEntry = {
      timestamp: Date.now(),
      action: input.id ? 'Modificación' : 'Carga Lectura',
      description: `Lectura cargada: ${input.initial} inicial -> ${input.final} final. Neto: $${billing.netCost}, Total: $${billing.total}`,
      user: 'Administrativo',
    };

    let existingHistory: any[] = [];
    if (input.id) {
      const existingResults = await db.select({ history: readings.history }).from(readings).where(eq(readings.id, input.id)).limit(1);
      if (existingResults[0]) {
        existingHistory = existingResults[0].history as any[];
      }
    }
    const finalHistory = [...existingHistory, timelineEntry];

    const readingData = {
      machineId: input.machineId,
      clientId: machine.clientId,
      abonoId: machine.abonoId,
      month: input.month,
      initial: input.initial,
      final: input.final,
      readingStatus: input.readingStatus,
      billingStatus: input.billingStatus,
      collectionStatus: input.collectionStatus,
      comments: input.comments || null,
      invoiceNumber: input.invoiceNumber || null,
      invoiceDate: input.invoiceDate || null,
      dueDate,
      paymentAmount: input.collectionStatus === 'cobrado' ? billing.total : 0,
      paymentDate: input.collectionStatus === 'cobrado' ? new Date().toISOString().split('T')[0] : null,
      isUnofficial,
      creditNote: input.creditNote,
      creditNoteReason: input.creditNoteReason || null,
      debitNote: input.debitNote,
      debitNoteReason: input.debitNoteReason || null,
      invoiceFile: input.invoiceFile || null,
      history: finalHistory,
    };

    if (input.id) {
      await db.update(readings).set(readingData).where(eq(readings.id, input.id));
    } else {
      const newId = 'read-' + Date.now();
      await db.insert(readings).values({
        id: newId,
        ...readingData,
      });
    }

    // 5. Sincronizar el acumulador/contador de la máquina a la última lectura final
    await db
      .update(machines)
      .set({ machineCounter: input.final, updatedAt: new Date() })
      .where(eq(machines.id, input.machineId));

    revalidatePath('/lecturas');
    return { success: true, alerts: auditAlerts };
  } catch (error: any) {
    console.error('Error al guardar la lectura mensual:', error);
    return { error: 'Error del servidor al registrar la lectura en la base de datos.' };
  }
}
