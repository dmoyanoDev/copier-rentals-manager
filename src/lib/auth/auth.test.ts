import { describe, it, expect } from 'vitest';
import { validatePasswordStrength } from './passwordService';

describe('Servicio de Validación de Contraseñas', () => {
  it('debería aceptar contraseñas con complejidad válida', () => {
    const result = validatePasswordStrength('Ejemplo2024$');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('debería rechazar contraseñas de menos de 8 caracteres', () => {
    const result = validatePasswordStrength('Ejm2$');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('al menos 8 caracteres');
  });

  it('debería rechazar contraseñas sin letras mayúsculas', () => {
    const result = validatePasswordStrength('ejemplo2024$');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('letra mayúscula');
  });

  it('debería rechazar contraseñas sin letras minúsculas', () => {
    const result = validatePasswordStrength('EJEMPLO2024$');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('letra minúscula');
  });

  it('debería rechazar contraseñas sin números', () => {
    const result = validatePasswordStrength('Ejemploxxxx$');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('un número');
  });

  it('debería rechazar contraseñas sin caracteres especiales', () => {
    const result = validatePasswordStrength('Ejemplo20242');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('carácter especial');
  });
});
