import { db } from '@/infrastructure/db/client';
import { auditLogs } from '@/infrastructure/db/schema/auditLogs';

/**
 * Registra un evento de seguridad en la tabla audit_logs de forma consistente y compatible.
 */
export async function logSecurityEvent(
  action: 'login_success' | 'login_failed' | 'logout' | 'forgot_password_requested' | 'password_reset_success' | 'password_change_success' | 'session_revoked' | 'user_created' | 'user_updated' | 'user_deactivated' | 'forbidden_access' | 'role_change_attempt' | 'protected_master_modification_attempt',
  user: string,
  details: string
) {
  try {
    const id = 'sec-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    await db.insert(auditLogs).values({
      id,
      module: 'seguridad',
      action,
      details,
      user,
    });
  } catch (err) {
    console.error('Error al registrar auditoría de seguridad:', err);
  }
}
