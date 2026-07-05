import { Ticket, User } from '@/lib/mockData';

/**
 * Algoritmo de autoasignación inteligente para tickets técnicos.
 * Evalúa a los técnicos en base a disponibilidad, zona de cobertura, especialidad de marca/equipo y carga de trabajo.
 */
export function autoAssignTech(
  ticket: Ticket,
  techList: User[],
  activeTickets: Ticket[]
): { techId: string | null; score: number; reason: string } {
  // 1. Filtrar técnicos activos y disponibles
  const availableTechs = techList.filter(
    (t) => t.role === 'tecnico' && t.active !== false && t.availability === 'Disponible'
  );

  if (availableTechs.length === 0) {
    return {
      techId: null,
      score: 0,
      reason: 'No hay técnicos disponibles o activos en este momento.'
    };
  }

  const clientAddress = (ticket.clientAddress || '').toLowerCase();
  const machineDesc = (ticket.machineDesc || '').toLowerCase();
  const category = (ticket.category || '').toLowerCase();

  const scoringResults = availableTechs.map((tech) => {
    let score = 0;
    const reasons: string[] = [];

    // A. Evaluación de Zona (+3 puntos)
    if (tech.zone) {
      const techZones = tech.zone.toLowerCase().split(/[\s,()/-]+/);
      const addressWords = clientAddress.split(/[\s,()/-]+/);
      
      const zoneMatch = techZones.some(
        (zWord) => zWord.length > 3 && addressWords.includes(zWord)
      );

      if (zoneMatch) {
        score += 3;
        reasons.push('Coincidencia de zona de cobertura (+3)');
      }
    }

    // B. Evaluación de Especialidad / Marcas (+4 puntos)
    if (tech.specialty) {
      const specialtyTerms = tech.specialty.toLowerCase().split(/[\s,()/-]+/);
      const machineTerms = machineDesc.split(/[\s,()/-]+/);
      const categoryTerms = category.split(/[\s,()/-]+/);

      const specialtyMatch = specialtyTerms.some(
        (term) => term.length > 2 && (machineTerms.includes(term) || categoryTerms.includes(term))
      );

      if (specialtyMatch) {
        score += 4;
        reasons.push('Coincidencia de especialidad o marca (+4)');
      }
    }

    // C. Carga de Trabajo Activa (-1 punto por ticket activo)
    const techActiveTickets = activeTickets.filter(
      (t) => t.assignedTechId === tech.id && !['resuelto', 'cerrado'].includes(t.status)
    );
    const activeCount = techActiveTickets.length;
    score -= activeCount;
    if (activeCount > 0) {
      reasons.push(`Penalización por carga de trabajo (-${activeCount} por ${activeCount} tickets activos)`);
    } else {
      reasons.push('Sin carga de trabajo activa (+0)');
    }

    return {
      tech,
      score,
      activeCount,
      reason: reasons.join(', ') || 'Criterios básicos'
    };
  });

  // Ordenar por score descendente, y desempatar por menor carga de trabajo (activeCount ascendente)
  scoringResults.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.activeCount - b.activeCount;
  });

  const bestResult = scoringResults[0];

  return {
    techId: bestResult.tech.id,
    score: bestResult.score,
    reason: `Asignado a ${bestResult.tech.fullname}. Motivo: ${bestResult.reason}`
  };
}
