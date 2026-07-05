import { describe, it, expect } from 'vitest';
import { defaultBudgetTemplates } from './presets';

describe('Budget Templates', () => {
    it('should have exactly 5 templates', () => {
        expect(defaultBudgetTemplates.length).toBe(5);
    });

    it('should contain the correct template IDs and types', () => {
        const expectedTemplates = [
            { id: 'temp-alquiler', type: 'alquiler' },
            { id: 'temp-insumos', type: 'insumo' },
            { id: 'temp-repuesto', type: 'repuesto' },
            { id: 'temp-servicio', type: 'servicio_tecnico' },
            { id: 'temp-mixto', type: 'mixto' }
        ];

        expectedTemplates.forEach(({ id, type }) => {
            const template = defaultBudgetTemplates.find(t => t.id === id);
            expect(template).toBeDefined();
            expect(template?.tipo).toBe(type);
        });
    });

    it('should contain authentic M&S Tecnologia Digital details in alquiler template', () => {
        const alquiler = defaultBudgetTemplates.find(t => t.id === 'temp-alquiler');
        expect(alquiler?.defaultIntroText).toContain('fotocopiadoras multifunción M&S Tecnología Digital');
        expect(alquiler?.defaultConditionsText).toContain('Plazo Mínimo Contrato: 12 meses');
        expect(alquiler?.defaultConditionsText).toContain('Trimestral según el Índice de Precios al Consumidor (IPC)');
        expect(alquiler?.defaultIncludesText).toContain('Suministro de todos los consumibles necesarios');
        expect(alquiler?.defaultExcludesText).toContain('El suministro de papel');
        expect(alquiler?.defaultRequirementsText).toContain('Firma de contrato de alquiler no menos de 6 meses y pagaré');
    });
});
