import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { getSession } from '@/infrastructure/auth/session';
import { eq, sql } from 'drizzle-orm';
import {
  clients,
  machines,
  readings,
  tickets,
  plans,
  users,
  rentals,
  budgets,
} from '@/infrastructure/db/schema';
import {
  clientSyncSchema,
  machineSyncSchema,
  readingSyncSchema,
  ticketSyncSchema,
  planSyncSchema,
  userSyncSchema,
  rentalSyncSchema,
  budgetSyncSchema,
} from '@/lib/validation/syncSchemas';

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({
        error: 'Sesión no válida.',
        code: 'UNAUTHORIZED'
      }, { status: 401 });
    }

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({
        error: 'La carga útil debe contener un arreglo de cambios "items".',
        code: 'BAD_REQUEST'
      }, { status: 400 });
    }

    const results: any[] = [];

    await db.transaction(async (tx) => {
      for (const item of items) {
        const { id, entityId, entityType, operation, payload, updatedAt } = item;

        if (!id || !entityId || !entityType || !operation || !payload || !updatedAt) {
          results.push({
            id: id || 'unknown',
            status: 'failed',
            reason: 'missing_fields',
            message: 'Faltan campos obligatorios en el registro de cambio.'
          });
          continue;
        }

        // 1. Asignar tabla y esquema correspondientes
        let table: any;
        let schema: any;

        switch (entityType) {
          case 'clients':
            table = clients;
            schema = clientSyncSchema;
            break;
          case 'machines':
            table = machines;
            schema = machineSyncSchema;
            break;
          case 'readings':
            table = readings;
            schema = readingSyncSchema;
            break;
          case 'tickets':
            table = tickets;
            schema = ticketSyncSchema;
            break;
          case 'plans':
          case 'abonos':
            table = plans;
            schema = planSyncSchema;
            break;
          case 'users':
            table = users;
            schema = userSyncSchema;
            break;
          case 'rentals':
            table = rentals;
            schema = rentalSyncSchema;
            break;
          case 'budgets':
            table = budgets;
            schema = budgetSyncSchema;
            break;
          default:
            results.push({
              id,
              status: 'failed',
              reason: 'invalid_entity_type',
              message: `Tipo de entidad inválido: ${entityType}`
            });
            continue;
        }

        // 2. Procesar operación de eliminación
        if (operation === 'delete') {
          try {
            await tx.delete(table).where(eq(table.id, entityId));
            results.push({ id, status: 'synced' });
          } catch (e: any) {
            console.error(`Error deleting entity ${entityType} ID ${entityId}:`, e);
            results.push({
              id,
              status: 'failed',
              reason: 'db_error',
              message: e.message
            });
          }
          continue;
        }

        // 3. Validar payload con Zod para operaciones de creación/actualización
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          console.error("!!! ZOD VALIDATION ERROR !!!", "Entity:", entityType, "ID:", entityId, "Error:", JSON.stringify(parsed.error.format(), null, 2));
          results.push({
            id,
            status: 'failed',
            reason: 'validation_error',
            details: parsed.error.format()
          });
          continue;
        }

        const cleanPayload = parsed.data;

        // Auto-reparar clientId y abonoId huérfanos para lecturas
        if (entityType === 'readings') {
          const rPayload = cleanPayload as any;
          if (!rPayload.clientId || !rPayload.abonoId) {
            const mach = await tx.select().from(machines).where(eq(machines.id, rPayload.machineId)).limit(1);
            if (mach.length > 0) {
              rPayload.clientId = rPayload.clientId || mach[0].clientId;
              rPayload.abonoId = rPayload.abonoId || mach[0].abonoId;
            }
          }
        }

          // 4. Compare Last-Write-Wins (LWW) against database
          try {
            const existing = await tx.select().from(table).where(eq(table.id, entityId)).limit(1);
            
            // Always stamp with server time so incremental queries on other devices pick it up correctly.
            // Client clocks can drift — server time is the authoritative timestamp for sync.
            const serverNow = new Date();
            const payloadWithServerTime = { ...cleanPayload, updatedAt: serverNow };
            
            if (existing.length > 0) {
              const dbItem: any = existing[0];
              const dbUpdatedAt = dbItem.updatedAt ? new Date(dbItem.updatedAt).getTime() : 0;
              const incomingUpdatedAt = new Date(cleanPayload.updatedAt || updatedAt).getTime();

              if (dbUpdatedAt > incomingUpdatedAt) {
                // El servidor tiene una versión más nueva. Omitimos escritura de forma exitosa.
                results.push({ id, status: 'synced', skipped: true, reason: 'server_has_newer_version' });
                continue;
              }

              // Actualizar registro existente con timestamp del servidor
              await tx.update(table).set(payloadWithServerTime).where(eq(table.id, entityId));
            } else {
              // Crear nuevo registro con timestamp del servidor
              await tx.insert(table).values(payloadWithServerTime);
            }
            results.push({ id, status: 'synced' });
          } catch (e: any) {
            console.error(`Error writing entity ${entityType} ID ${entityId}:`, e);
            results.push({
              id,
              status: 'failed',
              reason: 'db_error',
              message: e.message
            });
          }
      }
    });

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Error en API de procesamiento de sincronización:', error.message || error);
    return NextResponse.json({
      error: 'Error del servidor al procesar la cola de sincronización.',
      code: 'SERVER_ERROR'
    }, { status: 500 });
  }
}
