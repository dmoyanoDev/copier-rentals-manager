import { describe, it, expect } from 'vitest';
import { evaluateMachineRules } from './rules';

describe('evaluateMachineRules', () => {
  it('debe cambiar automáticamente a Usado si era Nuevo y el contador es mayor a 0', () => {
    const result = evaluateMachineRules({
      status: 'Nuevo',
      machineCounter: 120,
      isAvailable: true,
    });

    expect(result.status).toBe('Usado');
    expect(result.alertMessage).toContain('cambió a Usado automáticamente');
  });

  it('debe mantener el estado Nuevo si el contador es 0', () => {
    const result = evaluateMachineRules({
      status: 'Nuevo',
      machineCounter: 0,
      isAvailable: true,
    });

    expect(result.status).toBe('Nuevo');
    expect(result.alertMessage).toBeUndefined();
  });

  it('debe marcar como no disponible automáticamente si el estado es Scrap', () => {
    const result = evaluateMachineRules({
      status: 'Scrap',
      machineCounter: 50000,
      isAvailable: true,
    });

    expect(result.isAvailable).toBe(false);
    expect(result.alertMessage).toContain('marcan como No Disponibles automáticamente');
  });

  it('debe marcar como no disponible automáticamente si el estado es No funciona', () => {
    const result = evaluateMachineRules({
      status: 'No funciona',
      machineCounter: 32000,
      isAvailable: true,
    });

    expect(result.isAvailable).toBe(false);
  });
});
