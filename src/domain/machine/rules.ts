export interface MachineStateInput {
  status: string;
  machineCounter: number;
  isAvailable: boolean;
}

export interface MachineStateResult {
  status: string;
  isAvailable: boolean;
  alertMessage?: string;
}

/**
 * Aplica las reglas del dominio de Máquinas sobre el estado físico e inventario.
 * Por ejemplo: reasignación de estado 'Nuevo' a 'Usado' si tiene contador > 0,
 * y forzar indisponibilidad si está en Scrap o No Funciona.
 */
export function evaluateMachineRules(input: MachineStateInput): MachineStateResult {
  let status = input.status;
  let isAvailable = input.isAvailable;
  let alertMessage: string | undefined;

  if (status === 'Nuevo' && input.machineCounter > 0) {
    status = 'Usado';
    alertMessage = 'El equipo era Nuevo y al tener contador mayor a 0, cambió a Usado automáticamente';
  }

  if (status === 'Scrap' || status === 'No funciona') {
    isAvailable = false;
    alertMessage = 'Los equipos Scrap o No Funcionales se marcan como No Disponibles automáticamente';
  }

  return {
    status,
    isAvailable,
    alertMessage,
  };
}
