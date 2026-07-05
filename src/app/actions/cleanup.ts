'use server';

import { addAuditLogAction } from './audit';

export interface DiagnosedIssue {
  id: string; // Issue id
  category: 'cliente' | 'maquina' | 'alquiler' | 'lectura' | 'ticket';
  itemId: string; // The ID of the item having the issue
  description: string;
  type: 'huérfano' | 'incompleto' | 'inconsistente';
  itemLabel: string;
  data: any; // Raw object data
}

/**
 * Server Action para diagnosticar inconsistencias en los datos actuales
 */
export async function diagnoseDataAction(state: {
  clients: any[];
  machines: any[];
  readings: any[];
  tickets: any[];
  rentals: any[];
  abonos: any[];
}) {
  const issues: DiagnosedIssue[] = [];
  const { clients, machines, readings, tickets, rentals, abonos } = state;

  // Helper set structures for speed
  const clientIds = new Set(clients.map(c => c.id));
  const machineIds = new Set(machines.map(m => m.id));
  const abonoIds = new Set(abonos.map(a => a.id));

  // 1. Clientes
  clients.forEach(c => {
    if (!c.name || c.name.trim().toLowerCase() === 'desconocido' || c.name.trim() === '') {
      issues.push({
        id: `issue-c-name-${c.id}`,
        category: 'cliente',
        itemId: c.id,
        description: 'Cliente con nombre vacío o "Desconocido".',
        type: 'incompleto',
        itemLabel: `Cliente ID: ${c.id}`,
        data: c
      });
    }
    if (!c.cuit || c.cuit.trim() === '') {
      issues.push({
        id: `issue-c-cuit-${c.id}`,
        category: 'cliente',
        itemId: c.id,
        description: 'Cliente sin número de CUIT registrado.',
        type: 'incompleto',
        itemLabel: c.name || `Cliente ID: ${c.id}`,
        data: c
      });
    }
  });

  // 2. Máquinas
  machines.forEach(m => {
    if (!m.brand || !m.model || m.model.trim().toLowerCase() === 'equipo retirado' || m.model.trim() === '') {
      issues.push({
        id: `issue-m-desc-${m.id}`,
        category: 'maquina',
        itemId: m.id,
        description: 'Máquina con marca/modelo vacío o marcado como "Equipo Retirado".',
        type: 'incompleto',
        itemLabel: `Máquina S/N: ${m.serial || 'Sin Serie'} (ID: ${m.id})`,
        data: m
      });
    }
    if (!m.serial || m.serial.trim() === '') {
      issues.push({
        id: `issue-m-serial-${m.id}`,
        category: 'maquina',
        itemId: m.id,
        description: 'Máquina registrada sin número de serie.',
        type: 'incompleto',
        itemLabel: `${m.brand} ${m.model}` || `Máquina ID: ${m.id}`,
        data: m
      });
    }
    // References
    if (m.clientId && !clientIds.has(m.clientId)) {
      issues.push({
        id: `issue-m-clientref-${m.id}`,
        category: 'maquina',
        itemId: m.id,
        description: `Máquina asignada al cliente inexistente ID "${m.clientId}".`,
        type: 'huérfano',
        itemLabel: `${m.brand} ${m.model} (S/N: ${m.serial})`,
        data: m
      });
    }
    if (m.abonoId && !abonoIds.has(m.abonoId)) {
      issues.push({
        id: `issue-m-abonoref-${m.id}`,
        category: 'maquina',
        itemId: m.id,
        description: `Máquina asignada al abono inexistente ID "${m.abonoId}".`,
        type: 'huérfano',
        itemLabel: `${m.brand} ${m.model} (S/N: ${m.serial})`,
        data: m
      });
    }
  });

  // 3. Alquileres
  rentals.forEach(r => {
    if (!clientIds.has(r.clientId)) {
      issues.push({
        id: `issue-rt-clientref-${r.id}`,
        category: 'alquiler',
        itemId: r.id,
        description: `Contrato de alquiler vinculado a un cliente inexistente (ID "${r.clientId}").`,
        type: 'huérfano',
        itemLabel: `Alquiler Contrato ID: ${r.id}`,
        data: r
      });
    }
    if (!machineIds.has(r.machineId)) {
      issues.push({
        id: `issue-rt-machineref-${r.id}`,
        category: 'alquiler',
        itemId: r.id,
        description: `Contrato de alquiler vinculado a una máquina inexistente (ID "${r.machineId}").`,
        type: 'huérfano',
        itemLabel: `Alquiler Contrato ID: ${r.id}`,
        data: r
      });
    }
  });

  // 4. Lecturas
  readings.forEach(rd => {
    if (!machineIds.has(rd.machineId)) {
      issues.push({
        id: `issue-rd-machineref-${rd.id}`,
        category: 'lectura',
        itemId: rd.id,
        description: `Lectura cargada para una máquina inexistente (ID "${rd.machineId}").`,
        type: 'huérfano',
        itemLabel: `Lectura mes: ${rd.month} (ID: ${rd.id})`,
        data: rd
      });
    }
    if (rd.totalAmount < 0 || isNaN(rd.totalAmount)) {
      issues.push({
        id: `issue-rd-amount-${rd.id}`,
        category: 'lectura',
        itemId: rd.id,
        description: `Lectura con importe total inválido ($${rd.totalAmount}).`,
        type: 'inconsistente',
        itemLabel: `Lectura mes: ${rd.month} (ID: ${rd.id})`,
        data: rd
      });
    }
  });

  // 5. Tickets técnicos
  tickets.forEach(t => {
    if (t.machineId && !machineIds.has(t.machineId)) {
      issues.push({
        id: `issue-t-machineref-${t.id}`,
        category: 'ticket',
        itemId: t.id,
        description: `Ticket técnico asociado a una máquina inexistente (ID "${t.machineId}").`,
        type: 'huérfano',
        itemLabel: `Ticket Nro: TCK-${t.id.replace('ticket-', '')}`,
        data: t
      });
    }
    if (t.clientId && !clientIds.has(t.clientId)) {
      issues.push({
        id: `issue-t-clientref-${t.id}`,
        category: 'ticket',
        itemId: t.id,
        description: `Ticket técnico asociado a un cliente inexistente (ID "${t.clientId}").`,
        type: 'huérfano',
        itemLabel: `Ticket Nro: TCK-${t.id.replace('ticket-', '')}`,
        data: t
      });
    }
  });

  return { success: true, issues };
}

/**
 * Server Action para registrar un log de auditoría por una operación de limpieza ejecutada en la UI
 */
export async function logCleanupOperationAction(details: string, user: string) {
  await addAuditLogAction({
    module: 'datos',
    action: 'limpieza',
    details,
    user
  });
  return { success: true };
}
