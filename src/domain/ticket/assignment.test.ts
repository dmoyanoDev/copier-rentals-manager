import { describe, it, expect } from 'vitest';
import { autoAssignTech } from './assignment';
import { Ticket, User } from '@/lib/mockData';

describe('autoAssignTech', () => {
  const mockTechs: User[] = [
    {
      id: 'tech-1',
      fullname: 'Marcelo Gómez',
      username: 'mgomez',
      email: 'mgomez@test.com',
      role: 'tecnico',
      active: true,
      availability: 'Disponible',
      zone: 'Yerba Buena, Tucumán',
      specialty: 'Ricoh, Color'
    },
    {
      id: 'tech-2',
      fullname: 'Lucas Peralta',
      username: 'lperalta',
      email: 'lperalta@test.com',
      role: 'tecnico',
      active: true,
      availability: 'Disponible',
      zone: 'Banda del Río Salí, Tucumán',
      specialty: 'HP, Brother, Monocromo'
    },
    {
      id: 'tech-3',
      fullname: 'Offline Tech',
      username: 'offline',
      email: 'offline@test.com',
      role: 'tecnico',
      active: true,
      availability: 'No disponible',
      zone: 'Yerba Buena, Tucumán',
      specialty: 'Ricoh'
    }
  ];

  it('debería no asignar si no hay técnicos disponibles', () => {
    const ticket: Ticket = {
      id: 't-1',
      clientName: 'Cliente A',
      clientAddress: 'Yerba Buena',
      machineDesc: 'Ricoh MP 301',
      category: 'Servicio',
      priority: 'media',
      status: 'nuevo',
      description: 'Problema fusor',
      serialNumber: 'SN-01',
      clientType: 'externo',
      date: '',
      time: '',
      diagnostic: '',
      actionTaken: '',
      partsNeeded: '',
      partsUsed: '',
      internalNotes: '',
      assignedTechId: null,
      slaDate: '',
      machineId: null,
      clientId: null
    };

    // Si pasamos técnicos no disponibles
    const result = autoAssignTech(ticket, [mockTechs[2]], []);
    expect(result.techId).toBeNull();
    expect(result.reason).toContain('No hay técnicos disponibles');
  });

  it('debería preferir técnico por especialidad y zona', () => {
    const ticket: Ticket = {
      id: 't-2',
      clientName: 'Cliente Yerba Buena',
      clientAddress: 'Av. Aconquija 1200, Yerba Buena',
      machineDesc: 'Ricoh IM 430 Color',
      category: 'Servicio',
      priority: 'media',
      status: 'nuevo',
      description: 'Atasco en unidad de fusión',
      serialNumber: 'SN-02',
      clientType: 'externo',
      date: '',
      time: '',
      diagnostic: '',
      actionTaken: '',
      partsNeeded: '',
      partsUsed: '',
      internalNotes: '',
      assignedTechId: null,
      slaDate: '',
      machineId: null,
      clientId: null
    };

    const result = autoAssignTech(ticket, mockTechs, []);
    // tech-1 coincide con Yerba Buena (+3) y Ricoh/Color (+4) -> score 7
    // tech-2 no coincide -> score 0
    expect(result.techId).toBe('tech-1');
    expect(result.score).toBe(7);
  });

  it('debería penalizar por carga de trabajo', () => {
    const ticket: Ticket = {
      id: 't-3',
      clientName: 'Cliente Yerba Buena',
      clientAddress: 'Av. Aconquija 1200, Yerba Buena',
      machineDesc: 'Ricoh IM 430 Color',
      category: 'Servicio',
      priority: 'media',
      status: 'nuevo',
      description: 'Problema fusor',
      serialNumber: 'SN-02',
      clientType: 'externo',
      date: '',
      time: '',
      diagnostic: '',
      actionTaken: '',
      partsNeeded: '',
      partsUsed: '',
      internalNotes: '',
      assignedTechId: null,
      slaDate: '',
      machineId: null,
      clientId: null
    };

    // Simulamos que tech-1 tiene 10 tickets activos asignados
    const activeTickets: Ticket[] = Array.from({ length: 10 }, (_, i) => ({
      id: `act-${i}`,
      clientName: 'Cliente X',
      clientAddress: 'Dirección X',
      machineDesc: 'Ricoh',
      category: 'Servicio',
      priority: 'media',
      status: 'asignado',
      description: 'Falla',
      serialNumber: 'SN',
      clientType: 'externo',
      date: '',
      time: '',
      diagnostic: '',
      actionTaken: '',
      partsNeeded: '',
      partsUsed: '',
      internalNotes: '',
      assignedTechId: 'tech-1',
      slaDate: '',
      machineId: null,
      clientId: null
    }));

    const result = autoAssignTech(ticket, mockTechs, activeTickets);
    // tech-1: base score 7 - 10 active tickets = -3
    // tech-2: base score 0 - 0 active tickets = 0
    // tech-2 debería ganar debido a la alta carga de trabajo de tech-1
    expect(result.techId).toBe('tech-2');
  });
});
