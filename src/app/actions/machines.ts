'use server';

import { db } from '@/infrastructure/db/client';
import { machines } from '@/infrastructure/db/schema/machines';
import { eq } from 'drizzle-orm';
import { machineFormSchema, MachineFormValues } from '@/domain/machine/validation';
import { evaluateMachineRules } from '@/domain/machine/rules';
import { revalidatePath } from 'next/cache';

/**
 * Server Action para guardar (crear o editar) una Máquina en PostgreSQL.
 * Valida mediante Zod y aplica automáticamente las reglas de negocio del dominio.
 */
export async function saveMachineAction(values: MachineFormValues) {
  const result = machineFormSchema.safeParse(values);
  if (!result.success) {
    return { 
      error: 'Datos del equipo inválidos: ' + result.error.issues.map(e => e.message).join(', ') 
    };
  }

  const validatedData = result.data;
  
  // Aplicar reglas automáticas de dominio
  const ruleResult = evaluateMachineRules({
    status: validatedData.status,
    machineCounter: validatedData.machineCounter,
    isAvailable: validatedData.isAvailable,
  });

  const finalStatus = ruleResult.status;
  const finalAvailability = ruleResult.isAvailable;

  try {
    const machineData = {
      brand: validatedData.brand,
      model: validatedData.model,
      serial: validatedData.serial,
      type: validatedData.type,
      status: finalStatus,
      machineCounter: validatedData.machineCounter,
      clientId: validatedData.clientId || null,
      abonoId: validatedData.abonoId || null,
      installationDate: validatedData.clientId ? (validatedData.installationDate || new Date().toISOString().split('T')[0]) : null,
      initialCounter: validatedData.clientId ? validatedData.initialCounter : 0,
      applyIva: validatedData.clientId ? validatedData.applyIva : false,
      readingDay: validatedData.clientId ? validatedData.readingDay : 10,
      isAvailable: finalAvailability,
      pdfUrl: validatedData.pdfUrl || null,
      features: validatedData.features || null,
      updatedAt: new Date(),
    };

    if (validatedData.id) {
      await db.update(machines).set(machineData).where(eq(machines.id, validatedData.id));
    } else {
      const newId = 'machine-' + Date.now();
      await db.insert(machines).values({
        id: newId,
        ...machineData,
      });
    }
  } catch (error: any) {
    console.error('Error al guardar equipo:', error);
    return { error: 'Error del servidor al intentar guardar el equipo.' };
  }

  revalidatePath('/maquinas');
  return { success: true, alertMessage: ruleResult.alertMessage };
}

/**
 * Server Action para eliminar una Máquina de PostgreSQL.
 */
export async function deleteMachineAction(id: string) {
  try {
    await db.delete(machines).where(eq(machines.id, id));
  } catch (error: any) {
    console.error('Error al eliminar equipo:', error);
    return { error: 'Error del servidor al intentar eliminar el equipo.' };
  }

  revalidatePath('/maquinas');
  return { success: true };
}
