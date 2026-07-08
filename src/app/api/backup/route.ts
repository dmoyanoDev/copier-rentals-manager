import { NextResponse } from 'next/server';

// Always query Turso — never serve cached responses from CDN or Next.js ISR
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { db } from '@/infrastructure/db/client';
import { sql, gt, ne, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getSession } from '@/infrastructure/auth/session';

import { users } from '@/infrastructure/db/schema/users';
import { clients } from '@/infrastructure/db/schema/clients';
import { plans } from '@/infrastructure/db/schema/plans';
import { machines } from '@/infrastructure/db/schema/machines';
import { readings } from '@/infrastructure/db/schema/readings';
import { tickets } from '@/infrastructure/db/schema/tickets';
import { budgets } from '@/infrastructure/db/schema/budgets';
import { emailLogs } from '@/infrastructure/db/schema/emailLogs';
import { sharedPdfs } from '@/infrastructure/db/schema/sharedPdfs';
import { notificationSettings } from '@/infrastructure/db/schema/notificationSettings';
import { notificationHistory } from '@/infrastructure/db/schema/notificationHistory';
import { auditLogs } from '@/infrastructure/db/schema/auditLogs';
import { rentals } from '@/infrastructure/db/schema/rentals';

// Helper to write audit logs from server route handler
async function logServerAudit(module: string, action: string, details: string, user: string) {
  try {
    const id = 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    await db.insert(auditLogs).values({
      id,
      module,
      action,
      details,
      user,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('Failed to log server audit:', err);
  }
}

let isDbSchemaSynced = false;

async function ensureSchemaSynced(db: any) {
  if (isDbSchemaSynced) return;
  try {
    // 1. Ensure rentals table exists
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS rentals (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
        abono_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        startDate TEXT NOT NULL,
        endDate TEXT,
        status TEXT DEFAULT 'activo' NOT NULL,
        observations TEXT,
        history TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // 2. Ensure missing columns in users exist
    const usersColumns = [
      { name: 'is_master', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'phone', type: 'TEXT' },
      { name: 'whatsapp', type: 'TEXT' },
      { name: 'zone', type: 'TEXT' },
      { name: 'specialty', type: 'TEXT' },
      { name: 'availability', type: "TEXT NOT NULL DEFAULT 'Disponible'" },
      { name: 'active', type: 'INTEGER NOT NULL DEFAULT 1' },
      { name: 'work_hours', type: 'TEXT' },
      { name: 'internal_notes', type: 'TEXT' },
      { name: 'last_login_at', type: 'INTEGER' },
      { name: 'failed_login_attempts', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'locked_until', type: 'INTEGER' }
    ];
    for (const col of usersColumns) {
      try {
        await db.run(sql.raw(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`));
      } catch (e) {}
    }

    // 3. Ensure missing columns in tickets exist
    const ticketsColumns = [
      { name: 'client_address', type: 'TEXT' },
      { name: 'client_phone', type: 'TEXT' },
      { name: 'client_email', type: 'TEXT' },
      { name: 'client_contact', type: 'TEXT' },
      { name: 'technical_cost', type: 'INTEGER' },
      { name: 'observations', type: 'TEXT' },
      { name: 'resolved_at', type: 'INTEGER' },
      { name: 'updated_at', type: 'INTEGER NOT NULL DEFAULT 0' }
    ];
    for (const col of ticketsColumns) {
      try {
        await db.run(sql.raw(`ALTER TABLE tickets ADD COLUMN ${col.name} ${col.type}`));
      } catch (e) {}
    }

    // 4. Ensure missing columns in plans exist
    try {
      await db.run(sql`ALTER TABLE plans ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`);
    } catch (e) {}

    // 5. Ensure missing columns in readings exist
    try {
      await db.run(sql`ALTER TABLE readings ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`);
    } catch (e) {}

    // 6. Ensure missing columns in clients exist
    const clientsColumns = [
      { name: 'tax_category', type: "TEXT NOT NULL DEFAULT 'Monotributista'" },
      { name: 'debt', type: 'REAL NOT NULL DEFAULT 0' },
      { name: 'active', type: 'INTEGER NOT NULL DEFAULT 1' }
    ];
    for (const col of clientsColumns) {
      try {
        await db.run(sql.raw(`ALTER TABLE clients ADD COLUMN ${col.name} ${col.type}`));
      } catch (e) {}
    }

    isDbSchemaSynced = true;
    console.log("Database schema auto-sync completed successfully.");
  } catch (err) {
    console.error("Error auto-syncing database schema:", err);
  }
}

/**
 * GET: Exporta un snapshot completo de la base de datos Turso como JSON.
 */
export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
    }

    await ensureSchemaSynced(db);
    const { searchParams } = new URL(request.url);
    const user = searchParams.get('user') || session.username || 'system';
    const sinceParam = searchParams.get('since');
    const sinceDate = sinceParam ? new Date(sinceParam) : null;
    const isValidSince = sinceDate && !isNaN(sinceDate.getTime());
    const sinceSeconds = isValidSince ? Math.floor(sinceDate!.getTime() / 1000) : 0;

    const isSystemSync = user === 'system' || user === 'autosave';

    const [
      dbUsers,
      dbClients,
      dbPlans,
      dbMachines,
      dbReadings,
      dbTickets,
      dbBudgets,
      dbEmailLogs,
      dbSharedPdfs,
      dbNotifSettings,
      dbNotifHistory,
      dbAuditLogs,
      dbRentals
    ] = await Promise.all([
      isValidSince ? db.select().from(users).where(sql`${users.updatedAt} > ${sinceSeconds}`) : db.select().from(users),
      isValidSince ? db.select().from(clients).where(sql`${clients.updatedAt} > ${sinceSeconds}`) : db.select().from(clients),
      isValidSince ? db.select().from(plans).where(sql`${plans.updatedAt} > ${sinceSeconds}`) : db.select().from(plans),
      isValidSince ? db.select().from(machines).where(sql`${machines.updatedAt} > ${sinceSeconds}`) : db.select().from(machines),
      isValidSince ? db.select().from(readings).where(sql`${readings.updatedAt} > ${sinceSeconds}`) : db.select().from(readings),
      isValidSince ? db.select().from(tickets).where(sql`${tickets.updatedAt} > ${sinceSeconds}`) : db.select().from(tickets),
      isValidSince ? db.select().from(budgets).where(sql`${budgets.updatedAt} > ${sinceSeconds}`) : db.select().from(budgets),
      isSystemSync || isValidSince ? Promise.resolve([]) : db.select().from(emailLogs),
      isSystemSync || isValidSince ? Promise.resolve([]) : db.select().from(sharedPdfs),
      isValidSince ? Promise.resolve([]) : db.select().from(notificationSettings),
      isSystemSync || isValidSince ? Promise.resolve([]) : db.select().from(notificationHistory),
      isSystemSync || isValidSince ? Promise.resolve([]) : db.select().from(auditLogs),
      isValidSince ? db.select().from(rentals).where(sql`${rentals.updatedAt} > ${sinceSeconds}`) : db.select().from(rentals)
    ]);

    const backupPayload = {
      users: dbUsers,
      clients: dbClients,
      plans: dbPlans,
      machines: dbMachines,
      readings: dbReadings,
      tickets: dbTickets,
      budgets: dbBudgets,
      emailLogs: dbEmailLogs,
      sharedPdfs: dbSharedPdfs,
      notificationSettings: dbNotifSettings,
      notificationHistory: dbNotifHistory,
      auditLogs: dbAuditLogs,
      rentals: dbRentals,
      backupMeta: {
        exportDate: new Date().toISOString(),
        version: '2.0.0',
        engine: 'Turso SQLite Cloud'
      }
    };

    // Only log audit for manual (non-sync) backups to avoid flooding the audit_logs table
    if (!isSystemSync) {
      await logServerAudit('datos', 'backup', `Copia de seguridad de base de datos Turso descargada con éxito. Total registros exportados: ${dbClients.length} clientes, ${dbMachines.length} copiadoras.`, user);
    }

    return new Response(JSON.stringify(backupPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="turso_backup_${new Date().toISOString().split('T')[0]}.json"`,
        // Prevent ALL caching layers from serving a stale snapshot
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'CDN-Cache-Control': 'no-store',
        'Netlify-CDN-Cache-Control': 'no-store',
        'Surrogate-Control': 'no-store',
        'Vary': 'Accept-Encoding',
      },
    });
  } catch (error: any) {
    console.error('Error al generar copia de seguridad Turso:', error);
    return NextResponse.json({ error: 'Error del servidor al exportar base de datos: ' + error.message }, { status: 500 });
  }
}

/**
 * POST: Restaura la base de datos Turso a partir de un snapshot JSON.
 * Reemplaza todas las tablas del sistema transaccionalmente.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
    }

    await ensureSchemaSynced(db);
    const { searchParams } = new URL(request.url);
    const isAutosave = searchParams.get('user') === 'autosave';
    const user = session.username || 'system';
    const payload = await request.json();

    if (!payload.clients || !payload.machines || !payload.plans || !payload.users) {
      return NextResponse.json({ error: 'El archivo JSON de respaldo no contiene las tablas mínimas para la restauración de la base de datos.' }, { status: 400 });
    }

    // Process database restore inside a transaction block
    await db.transaction(async (tx) => {
      // 1. Delete all rows from target tables only if they are present in the payload to preserve logs during autosaves
      if (payload.notificationHistory !== undefined) await tx.delete(notificationHistory);
      if (payload.notificationSettings !== undefined) await tx.delete(notificationSettings);
      if (payload.sharedPdfs !== undefined) await tx.delete(sharedPdfs);
      if (payload.emailLogs !== undefined) await tx.delete(emailLogs);
      await tx.delete(rentals);
      await tx.delete(budgets);
      await tx.delete(tickets);
      await tx.delete(readings);
      await tx.delete(machines);
      await tx.delete(plans);
      await tx.delete(clients);
      if (!isAutosave) {
        await tx.delete(users).where(ne(users.id, session.userId));
      }
      if (payload.auditLogs !== undefined) await tx.delete(auditLogs);

      // 2. Insert new rows if present
      if (!isAutosave && payload.users?.length) {
        for (const u of payload.users) {
          const hasInvalidPassword = !u.passwordHash || u.passwordHash.length < 10;
          // If the user already has a valid hash, keep it. Never hardcode passwords in source.
          const finalPasswordHash = hasInvalidPassword ? '' : u.passwordHash;

          if (u.id === session.userId) {
            // Update current user to avoid constraint collision and preserve session reference
            await tx.update(users).set({
              username: u.username || 'user-' + Math.random().toString(36).substring(2, 6),
              fullname: u.fullname || 'Usuario',
              email: u.email || `${u.username || 'user'}@example.com`,
              // Keep original password hash if payload does not have one
              ...(u.passwordHash ? { passwordHash: u.passwordHash } : {}),
              role: u.role || 'administrativo',
              isMaster: u.isMaster ?? (u.role === 'master' || u.id === 'user-admin' ? 1 : 0),
              phone: u.phone || null,
              whatsapp: u.whatsapp || null,
              zone: u.zone || null,
              specialty: u.specialty || null,
              availability: u.availability || 'Disponible',
              active: (u.active === false || u.active === 0) ? 0 : 1,
              workHours: u.workHours || null,
              internalNotes: u.internalNotes || null
            }).where(eq(users.id, session.userId));
          } else {
            await tx.insert(users).values({
              id: u.id,
              username: u.username || 'user-' + Math.random().toString(36).substring(2, 6),
              fullname: u.fullname || 'Usuario',
              email: u.email || `${u.username || 'user'}@example.com`,
              passwordHash: finalPasswordHash,
              role: u.role || 'administrativo',
              isMaster: u.isMaster ?? (u.role === 'master' || u.id === 'user-admin' ? 1 : 0),
              phone: u.phone || null,
              whatsapp: u.whatsapp || null,
              zone: u.zone || null,
              specialty: u.specialty || null,
              availability: u.availability || 'Disponible',
              active: (u.active === false || u.active === 0) ? 0 : 1,
              workHours: u.workHours || null,
              internalNotes: u.internalNotes || null
            });
          }
        }
      }

      if (payload.clients?.length) {
        for (const c of payload.clients) {
          await tx.insert(clients).values({
            id: c.id,
            name: c.name || 'Cliente sin nombre',
            phone: c.phone || null,
            email: c.email || null,
            address: c.address || null,
            cuit: c.cuit || null,
            notes: c.notes || null,
            taxCategory: c.taxCategory || 'Monotributista',
            debt: Number(c.debt) || 0,
            active: (c.active === false || c.active === 0) ? false : true,
            createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
            updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date()
          });
        }
      }

      const targetPlans = payload.plans || payload.abonos || [];
      if (targetPlans.length) {
        for (const p of targetPlans) {
          await tx.insert(plans).values({
            id: p.id,
            name: p.name || 'Plan Comercial',
            limit: p.limit || 0,
            price: Number(p.price) || 0,
            excessPrice: Number(p.excessPrice) || 0,
            ivaRate: Number(p.ivaRate) || 21,
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
            updatedAt: p.updatedAt ? new Date(p.updatedAt) : (p.createdAt ? new Date(p.createdAt) : new Date())
          });
        }
      }

      if (payload.machines?.length) {
        for (const m of payload.machines) {
          await tx.insert(machines).values({
            id: m.id,
            brand: m.brand || 'Desconocida',
            model: m.model || 'Desconocido',
            serial: m.serial || 'S/N-' + Math.random().toString(36).substring(2, 6),
            type: m.type || 'B&N',
            status: m.status || 'Usado',
            machineCounter: m.machineCounter || 0,
            clientId: m.clientId || null,
            abonoId: m.abonoId || null,
            installationDate: m.installationDate || null,
            initialCounter: m.initialCounter || 0,
            applyIva: m.applyIva ?? false,
            readingDay: m.readingDay || 10,
            isAvailable: m.isAvailable ?? true,
            pdfUrl: m.pdfUrl || null,
            features: m.features || null,
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date()
          });
        }
      }

      if (payload.readings?.length) {
        for (const r of payload.readings) {
          const mach = payload.machines?.find((m: any) => m.id === r.machineId);
          await tx.insert(readings).values({
            id: r.id,
            machineId: r.machineId || 'unknown',
            clientId: r.clientId || mach?.clientId || 'unknown',
            abonoId: r.abonoId || mach?.abonoId || 'unknown',
            month: r.month || new Date().toISOString().substring(0, 7),
            initial: r.initial || 0,
            final: r.final || 0,
            readingStatus: r.readingStatus || 'cargada',
            billingStatus: r.billingStatus || (r.status === 'facturada' ? 'Facturado' : 'No facturado'),
            collectionStatus: r.collectionStatus || (r.status === 'paid' ? 'Pagado' : 'Impago'),
            comments: r.comments || r.readingComment || null,
            invoiceNumber: r.invoiceNumber || null,
            invoiceDate: r.invoiceDate || null,
            dueDate: r.dueDate || null,
            paymentDate: r.paymentDate || null,
            paymentAmount: Number(r.paymentAmount) || 0,
            isUnofficial: r.isUnofficial ?? false,
            creditNote: Number(r.creditNote) || 0,
            creditNoteReason: r.creditNoteReason || null,
            debitNote: Number(r.debitNote) || 0,
            debitNoteReason: r.debitNoteReason || null,
            invoiceFile: r.invoiceFile || null,
            history: typeof r.history === 'string' ? JSON.parse(r.history) : (r.history || []),
            createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
            updatedAt: r.updatedAt ? new Date(r.updatedAt) : (r.createdAt ? new Date(r.createdAt) : new Date())
          });
        }
      }

      if (payload.tickets?.length) {
        for (const t of payload.tickets) {
          await tx.insert(tickets).values({
            id: t.id,
            clientType: t.clientType || 'existente',
            clientId: t.clientId || null,
            clientName: t.clientName || 'Cliente',
            clientAddress: t.clientAddress || null,
            clientPhone: t.clientPhone || null,
            clientEmail: t.clientEmail || null,
            clientContact: t.clientContact || null,
            machineId: t.machineId || null,
            machineDesc: t.machineDesc || 'Equipo',
            serialNumber: t.serialNumber || null,
            category: t.category || 'Servicio',
            requestType: t.requestType || 'Telefono',
            priority: t.priority || 'Media',
            status: t.status || 'nuevo',
            description: t.description || 'Sin descripción',
            diagnostic: t.diagnostic || null,
            partsNeeded: t.partsNeeded || null,
            partsUsed: t.partsUsed || null,
            internalNotes: t.internalNotes || null,
            actionTaken: t.actionTaken || null,
            assignedTechId: t.assignedTechId || null,
            technicalCost: Number(t.technicalCost) || null,
            observations: t.observations || null,
            slaDate: t.slaDate ? new Date(t.slaDate) : null,
            resolvedAt: t.resolvedAt ? new Date(t.resolvedAt) : null,
            closedAt: t.closedAt ? new Date(t.closedAt) : null,
            history: typeof t.history === 'string' ? JSON.parse(t.history) : (t.history || []),
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : (t.createdAt ? new Date(t.createdAt) : new Date())
          });
        }
      }

      if (payload.budgets?.length) {
        for (const b of payload.budgets) {
          await tx.insert(budgets).values({
            id: b.id,
            numero: b.numero,
            fecha: b.fecha,
            estado: b.estado || 'borrador',
            tipo: b.tipo,
            templateId: b.templateId || null,
            clientId: b.clientId || null,
            isNewClient: b.isNewClient ?? false,
            saveNewClient: b.saveNewClient ?? false,
            ivaMode: b.ivaMode || 'ADD_21',
            moneda: b.moneda || 'ARS',
            subtotal: Number(b.subtotal) || 0,
            discountType: b.discountType || 'NONE',
            discountValue: Number(b.discountValue) || 0,
            discountAmount: Number(b.discountAmount) || 0,
            ivaAmount: Number(b.ivaAmount) || 0,
            total: Number(b.total) || 0,
            validezOferta: b.validezOferta || '15 Días',
            plazoMinimoContrato: b.plazoMinimoContrato || '12 Meses',
            ajustePrecios: b.ajustePrecios || 'Trimestral según IPC',
            observaciones: b.observaciones || null,
            introText: b.introText || '',
            includesText: b.includesText || '',
            excludesText: b.excludesText || '',
            requirementsText: b.requirementsText || '',
            conditionsText: b.conditionsText || '',
            footerText: b.footerText || '',
            clientSnapshot: typeof b.clientSnapshot === 'string' ? JSON.parse(b.clientSnapshot) : (b.clientSnapshot || {}),
            items: typeof b.items === 'string' ? JSON.parse(b.items) : (b.items || []),
            machines: typeof b.machines === 'string' ? JSON.parse(b.machines) : (b.machines || []),
            sendLogs: typeof b.sendLogs === 'string' ? JSON.parse(b.sendLogs) : (b.sendLogs || []),
            createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
            updatedAt: b.updatedAt ? new Date(b.updatedAt) : new Date(),
            issuedAt: b.issuedAt ? new Date(b.issuedAt) : null
          });
        }
      }

      if (payload.rentals?.length) {
        for (const r of payload.rentals) {
          await tx.insert(rentals).values({
            id: r.id,
            clientId: r.clientId || 'unknown',
            machineId: r.machineId || 'unknown',
            abonoId: r.abonoId || 'unknown',
            startDate: r.startDate || new Date().toISOString().split('T')[0],
            endDate: r.endDate || null,
            status: r.status || 'activo',
            observations: r.observations || null,
            history: (() => {
              if (!r.history) return [];
              if (Array.isArray(r.history)) return r.history;
              if (typeof r.history === 'string') {
                try {
                  let parsed = JSON.parse(r.history);
                  if (typeof parsed === 'string') {
                    parsed = JSON.parse(parsed);
                  }
                  if (Array.isArray(parsed)) return parsed;
                } catch (e) {}
              }
              return [];
            })(),
            createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
            updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date()
          });
        }
      }

      if (payload.emailLogs?.length) {
        for (const el of payload.emailLogs) {
          await tx.insert(emailLogs).values({
            presupuestoId: el.presupuestoId,
            numeroPresupuesto: el.numeroPresupuesto,
            emailDestinatario: el.emailDestinatario,
            clienteNombre: el.clienteNombre,
            fechaEnvio: el.fechaEnvio,
            estado: el.estado || 'enviado'
          });
        }
      }

      if (payload.sharedPdfs?.length) {
        for (const sp of payload.sharedPdfs) {
          await tx.insert(sharedPdfs).values({
            id: sp.id,
            filename: sp.filename || sp.pdfName || '',
            pdfBase64: sp.pdfBase64 || '',
            createdAt: sp.createdAt ? String(sp.createdAt) : new Date().toISOString()
          });
        }
      }

      if (payload.notificationSettings?.length) {
        for (const ns of payload.notificationSettings) {
          await tx.insert(notificationSettings).values({
            id: ns.id,
            whatsappEnabled: ns.whatsappEnabled ? 1 : 0,
            emailEnabled: ns.emailEnabled ? 1 : 0,
            eventsConfig: typeof ns.eventsConfig === 'string' ? ns.eventsConfig : JSON.stringify(ns.eventsConfig || {}),
            templatesConfig: typeof ns.templatesConfig === 'string' ? ns.templatesConfig : JSON.stringify(ns.templatesConfig || {}),
            updatedAt: ns.updatedAt ? new Date(ns.updatedAt) : new Date()
          });
        }
      }

      if (payload.notificationHistory?.length) {
        for (const nh of payload.notificationHistory) {
          await tx.insert(notificationHistory).values({
            id: nh.id,
            ticketId: nh.ticketId,
            techId: nh.techId,
            recipient: nh.recipient,
            channel: nh.channel,
            event: nh.event,
            status: nh.status,
            message: nh.message,
            errorDetail: nh.errorDetail,
            createdAt: nh.createdAt ? new Date(nh.createdAt) : new Date()
          });
        }
      }

      if (payload.auditLogs?.length) {
        for (const al of payload.auditLogs) {
          await tx.insert(auditLogs).values({
            id: al.id,
            createdAt: al.createdAt ? new Date(al.createdAt) : new Date(),
            module: al.module,
            action: al.action,
            details: al.details,
            user: al.user
          });
        }
      }
    });

    // Write restoration audit entry
    await logServerAudit('datos', 'restauracion', `Base de datos Turso restaurada con éxito desde copia de seguridad JSON.`, user);

    return NextResponse.json({ success: true, message: 'La base de datos Turso fue restaurada correctamente.' });
  } catch (error: any) {
    console.error('Error al restaurar copia de seguridad Turso:', error);
    return NextResponse.json({ error: 'Error del servidor al restaurar base de datos: ' + error.message }, { status: 500 });
  }
}
