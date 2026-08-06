import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { getSession } from '@/infrastructure/auth/session';
import { isMasterUser } from '@/lib/auth/sessionDecrypt';
import { eq, sql, and } from 'drizzle-orm';
import { ensureSchemaSynced, logServerAudit } from '@/app/api/backup/route';
import {
  clients,
  machines,
  readings,
  tickets,
  plans,
  users,
  rentals,
  budgets,
  gestiones,
  cobranzaConfig as cobranzaConfigTable,
  syncTombstones,
  payments,
  machinePresets,
  budgetTemplates,
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
  gestionSyncSchema,
  cobranzaConfigSyncSchema,
  paymentSyncSchema,
  machinePresetSyncSchema,
  budgetTemplateSyncSchema,
} from '@/lib/validation/syncSchemas';
import { notifyDatabaseChange } from '../signal/route';


export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({
        error: 'Sesión no válida.',
        code: 'UNAUTHORIZED'
      }, { status: 401 });
    }

    await ensureSchemaSynced(db);
    const user = session.username || 'system';

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({
        error: 'La carga útil debe contener un arreglo de cambios "items".',
        code: 'BAD_REQUEST'
      }, { status: 400 });
    }

    // Sort items by dependency order
    const ENTITY_TYPE_ORDER: Record<string, number> = {
      'users': 0,
      'clients': 1,
      'plans': 2,
      'abonos': 2,
      'machines': 3,
      'readings': 4,
      'rentals': 5,
      'tickets': 6,
      'budgets': 7,
      'payments': 8,
      'machinePresets': 1,
      'templates': 1
    };

    const getOrder = (item: any) => {
      const baseOrder = ENTITY_TYPE_ORDER[item.entityType] ?? 99;
      if (item.operation === 'delete') {
        return 100 - baseOrder;
      }
      return baseOrder;
    };

    const sortedItems = [...items].sort((a: any, b: any) => {
      if (a.entityType === b.entityType && a.entityId === b.entityId) {
        return items.indexOf(a) - items.indexOf(b);
      }
      const orderA = getOrder(a);
      const orderB = getOrder(b);
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return items.indexOf(a) - items.indexOf(b);
    });

    const results: any[] = [];

    // Registro de auditoria: la pestana "Auditoria" en Datos y Respaldo ya tenia los
    // filtros de modulo/accion armados (clientes, maquinas, alquileres, abonos, lecturas,
    // tickets / crear, editar, eliminar) pero nada los alimentaba — logServerAudit solo se
    // llamaba desde backup/restore, asi que la pantalla siempre mostraba vacio para
    // cualquier accion real del dia a dia. Se junta la lista durante el loop y se escribe
    // DESPUES de que la transaccion confirma, para no sumar queries dentro de ella.
    const ENTITY_TO_MODULE: Record<string, string> = {
      clients: 'clientes',
      machines: 'maquinas',
      rentals: 'alquileres',
      plans: 'abonos',
      abonos: 'abonos',
      readings: 'lecturas',
      tickets: 'tickets',
    };
    const OPERATION_TO_ACTION: Record<string, string> = {
      create: 'crear',
      update: 'editar',
      delete: 'eliminar',
    };
    const auditEntries: { entityType: string; operation: string; entityId: string }[] = [];

    await db.transaction(async (tx) => {
      for (const item of sortedItems) {
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
          case 'gestiones':
            table = gestiones;
            schema = gestionSyncSchema;
            break;
          case 'payments':
            table = payments;
            schema = paymentSyncSchema;
            break;
          case 'machinePresets':
            table = machinePresets;
            schema = machinePresetSyncSchema;
            break;
          case 'templates':
            table = budgetTemplates;
            schema = budgetTemplateSyncSchema;
            break;
          case 'cobranzaConfig':
            table = cobranzaConfigTable;
            schema = cobranzaConfigSyncSchema;
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

        // 1b. Autorización especial para la entidad 'users': este es el canal genérico
        // usado para todas las escrituras cotidianas, a diferencia de /api/users (REST
        // dedicado, siempre master-only, con su propia validación). Sin este chequeo,
        // cualquier sesión autenticada podía escribir role/isMaster/passwordHash de
        // cualquier usuario — incluida la suya propia — y auto-promoverse a master.
        // Confirmado en vivo contra Turso antes de este fix.
        if (entityType === 'users' && !isMasterUser(session)) {
          if (session.role !== 'administrativo' || operation === 'delete') {
            results.push({
              id,
              status: 'failed',
              reason: 'forbidden',
              message: 'No tenés permisos para modificar usuarios.'
            });
            continue;
          }
          // Un administrativo solo puede mantener las fichas operativas de técnicos
          // (nombre/contacto/zona/disponibilidad, etc. — la pestaña "Personal Técnico"
          // en /tecnica). Nunca puede otorgarse ni otorgar rol/master, ni tocar
          // credenciales — eso sigue siendo exclusivo de /api/users (master-only).
          const p = payload as any;
          const isPrivilegeEscalation = p?.role !== 'tecnico' || Number(p?.isMaster) !== 0;
          if (isPrivilegeEscalation) {
            results.push({
              id,
              status: 'failed',
              reason: 'forbidden',
              message: 'Solo un usuario Maestro puede asignar roles administrativos o de master.'
            });
            continue;
          }
          if (operation === 'update') {
            const existingTarget = await tx.select({ role: users.role }).from(users).where(eq(users.id, entityId)).limit(1);
            if (existingTarget.length > 0 && existingTarget[0].role !== 'tecnico') {
              results.push({
                id,
                status: 'failed',
                reason: 'forbidden',
                message: 'No podés modificar una cuenta que no pertenece a un técnico.'
              });
              continue;
            }
          }
        }

        // 2. Procesar operación de eliminación
        if (operation === 'delete') {
          try {
            await tx.delete(table).where(eq(table.id, entityId));
            // Record a tombstone so other devices' incremental pulls learn this
            // row is gone (a hard DELETE leaves nothing for `since` to find).
            const tombstoneId = `${entityType}:${entityId}`;
            await tx.insert(syncTombstones).values({
              id: tombstoneId,
              entityType,
              entityId,
              deletedAt: new Date(),
            }).onConflictDoUpdate({
              target: syncTombstones.id,
              set: { deletedAt: new Date() },
            });
            results.push({ id, status: 'synced' });
            if (ENTITY_TO_MODULE[entityType]) {
              auditEntries.push({ entityType, operation: 'delete', entityId });
            }
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

        // Impedir que una misma máquina quede con dos alquileres activos simultáneos.
        // El único filtro que existía antes era del lado del cliente (lista de "máquinas
        // disponibles" en la UI), que puede quedar desactualizada en un dispositivo que
        // todavía no sincronizó el cambio de estado hecho en otro — confirmado en datos
        // reales de Turso antes de este fix.
        if (entityType === 'rentals' && (cleanPayload as any).status === 'activo') {
          const rPayload = cleanPayload as any;
          const conflicting = await tx
            .select({ id: rentals.id })
            .from(rentals)
            .where(and(eq(rentals.machineId, rPayload.machineId), eq(rentals.status, 'activo')));
          const hasOtherActiveRental = conflicting.some(r => r.id !== entityId);
          if (hasOtherActiveRental) {
            results.push({
              id,
              status: 'failed',
              reason: 'conflict',
              message: 'La máquina ya tiene otro alquiler activo. Finalizá o reasigná el contrato existente antes de activar uno nuevo.'
            });
            continue;
          }
        }

        if (entityType === 'readings') {
          const rPayload = cleanPayload as any;

          // Impedir que un mismo equipo quede con dos lecturas para el mismo mes —
          // la UI ya oculta el botón "Cargar" en cuanto existe una lectura, pero eso
          // no protege contra dos dispositivos cargándola en simultáneo (mismo tipo
          // de problema que el de alquileres duplicados de arriba).
          const conflictingReadings = await tx
            .select({ id: readings.id })
            .from(readings)
            .where(and(eq(readings.machineId, rPayload.machineId), eq(readings.month, rPayload.month)));
          const hasDuplicateReading = conflictingReadings.some(r => r.id !== entityId);
          if (hasDuplicateReading) {
            results.push({
              id,
              status: 'failed',
              reason: 'conflict',
              message: 'Ya existe una lectura cargada para este equipo en este período. Actualizá la lectura existente en vez de crear una nueva.'
            });
            continue;
          }

          // Auto-reparar clientId y abonoId huérfanos para lecturas
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

              // GET /api/backup ya no envía passwordHash al cliente (ver backup/route.ts),
              // así que un dispositivo editando la ficha de un usuario (p. ej. datos de
              // contacto de un técnico) nunca tiene el hash real en su estado local — el
              // payload trae passwordHash vacío por el default de userSyncSchema. Sin este
              // resguardo, cada edición legítima pisaría el hash real con '' y dejaría a
              // ese usuario sin poder iniciar sesión nunca más.
              if (entityType === 'users' && !(payloadWithServerTime as any).passwordHash) {
                (payloadWithServerTime as any).passwordHash = (dbItem as any).passwordHash;
              }

              // Actualizar registro existente con timestamp del servidor
              await tx.update(table).set(payloadWithServerTime).where(eq(table.id, entityId));
              if (ENTITY_TO_MODULE[entityType]) {
                auditEntries.push({ entityType, operation: 'update', entityId });
              }
            } else {
              // Crear nuevo registro con timestamp del servidor
              await tx.insert(table).values(payloadWithServerTime);
              if (ENTITY_TO_MODULE[entityType]) {
                auditEntries.push({ entityType, operation: 'create', entityId });
              }
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

    // Escribir el registro de auditoria fuera de la transaccion (no es critico que se
    // pierda si falla; no debe poder tumbar una sincronizacion ya confirmada).
    for (const entry of auditEntries) {
      const moduleLabel = ENTITY_TO_MODULE[entry.entityType];
      const actionLabel = OPERATION_TO_ACTION[entry.operation];
      await logServerAudit(moduleLabel, actionLabel, `${entry.entityType} ${actionLabel} (ID: ${entry.entityId})`, user);
    }

    notifyDatabaseChange();
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Error en API de procesamiento de sincronización:', error.message || error);
    return NextResponse.json({
      error: 'Error del servidor al procesar la cola de sincronización.',
      code: 'SERVER_ERROR'
    }, { status: 500 });
  }
}
