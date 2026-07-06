import { describe, it, expect } from 'vitest';
import { validatePasswordStrength } from './passwordService';

describe('Servicio de Validación de Contraseñas', () => {
  it('debería aceptar contraseñas con complejidad válida', () => {
    const result = validatePasswordStrength('Jueves2389$');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('debería rechazar contraseñas de menos de 8 caracteres', () => {
    const result = validatePasswordStrength('Juv2$');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('al menos 8 caracteres');
  });

  it('debería rechazar contraseñas sin letras mayúsculas', () => {
    const result = validatePasswordStrength('jueves2389$');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('letra mayúscula');
  });

  it('debería rechazar contraseñas sin letras minúsculas', () => {
    const result = validatePasswordStrength('JUEVES2389$');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('letra minúscula');
  });

  it('debería rechazar contraseñas sin números', () => {
    const result = validatePasswordStrength('Juevesxxxx$');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('un número');
  });

  it('debería rechazar contraseñas sin caracteres especiales', () => {
    const result = validatePasswordStrength('Jueves23899');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('carácter especial');
  });
});
