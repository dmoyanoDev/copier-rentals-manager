import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Singleton table: always one row with id='singleton'.
// Stores the cobranza (collections) configuration for the entire app instance.
export const cobranzaConfig = sqliteTable('cobranza_config', {
  id: text('id').primaryKey().default('singleton'),
  diasAvisoVencimiento: integer('dias_aviso_vencimiento').default(3).notNull(),
  montoMinimoAlerta: real('monto_minimo_alerta').default(50000).notNull(),
  diasMoraCritica: integer('dias_mora_critica').default(15).notNull(),
  plantillaEmail: text('plantilla_email').default('').notNull(),
  plantillaWhatsapp: text('plantilla_whatsapp').default('').notNull(),
  plantillaPreventivoEmail: text('plantilla_preventivo_email').default('').notNull(),
  plantillaPreventivoWhatsapp: text('plantilla_preventivo_whatsapp').default('').notNull(),
  plantillaDeudaVencidaEmail: text('plantilla_deuda_vencida_email').default('').notNull(),
  plantillaDeudaVencidaWhatsapp: text('plantilla_deuda_vencida_whatsapp').default('').notNull(),
  plantillaSegundoAvisoEmail: text('plantilla_segundo_aviso_email').default('').notNull(),
  plantillaSegundoAvisoWhatsapp: text('plantilla_segundo_aviso_whatsapp').default('').notNull(),
  plantillaPagoRecibidoEmail: text('plantilla_pago_recibido_email').default('').notNull(),
  plantillaPagoRecibidoWhatsapp: text('plantilla_pago_recibido_whatsapp').default('').notNull(),
  sonidosActivos: integer('sonidos_activos', { mode: 'boolean' }).default(true).notNull(),
  volumenSonidos: integer('volumen_sonidos').default(50).notNull(),
  autoAlertasActivas: integer('auto_alertas_activas', { mode: 'boolean' }).default(true).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
