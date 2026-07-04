'use server';

import { db } from '@/infrastructure/db/client';
import { clients } from '@/infrastructure/db/schema/clients';
import { eq } from 'drizzle-orm';
import { clientFormSchema, ClientFormValues } from '@/domain/client/validation';
import { revalidatePath } from 'next/cache';

/**
 * Server Action para guardar (crear o actualizar) un Cliente en PostgreSQL.
 * Valida los datos en el servidor mediante el esquema de Zod compartido.
 */
export async function saveClientAction(values: ClientFormValues) {
  const result = clientFormSchema.safeParse(values);
  if (!result.success) {
    return { 
      error: 'Datos del cliente inválidos: ' + result.error.issues.map(e => e.message).join(', ') 
    };
  }

  const clientData = result.data;
  try {
    if (clientData.id) {
      // Editar
      await db
        .update(clients)
        .set({
          name: clientData.name,
          phone: clientData.phone,
          email: clientData.email,
          address: clientData.address,
          cuit: clientData.cuit,
          notes: clientData.notes,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, clientData.id));
    } else {
      // Crear
      const newId = 'client-' + Date.now();
      await db.insert(clients).values({
        id: newId,
        name: clientData.name,
        phone: clientData.phone,
        email: clientData.email,
        address: clientData.address,
        cuit: clientData.cuit,
        notes: clientData.notes,
      });
    }
  } catch (error: any) {
    console.error('Error al guardar cliente:', error);
    return { error: 'Error del servidor al intentar guardar el cliente.' };
  }

  revalidatePath('/clientes');
  return { success: true };
}

/**
 * Server Action para eliminar un Cliente de PostgreSQL.
 */
export async function deleteClientAction(id: string) {
  try {
    await db.delete(clients).where(eq(clients.id, id));
  } catch (error: any) {
    console.error('Error al eliminar cliente:', error);
    return { error: 'Error del servidor al intentar eliminar el cliente.' };
  }

  revalidatePath('/clientes');
  return { success: true };
}
