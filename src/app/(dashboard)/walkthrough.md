# Walkthrough - Automatizaciones, Alertas y Sonidos de Cobranza

Se han sumado automatizaciones, alertas visuales y auditivas, y un historial de gestiones de cobro en CopyRent Manager. Todo el código permanece de forma **estrictamente local** y sin subir a producción.

---

## 1. Centro de Alertas Dinámico
*   **Calculador Centralizado (`utils.ts`)**: `getSystemAlerts(...)` evalúa de forma reactiva la base de datos local y genera avisos categorizados por severidad:
    *   🔵 **Informativa (Info)**: Cobros/pagos registrados recientemente o cuentas regularizadas en las últimas 72 horas.
    *   🟡 **Preventiva (Prev)**: Facturas que vencen pronto (dentro de los días configurados).
    *   🟠 **Importante (Imp)**: Facturas vencidas o comprobantes que vencen el día de hoy ("Vence Hoy").
    *   🔴 **Crítica (Crit)**: Cuentas con mora mayor a la tolerancia o deuda vencida que supera el umbral configurable.
*   **Visualización en Dashboard (`src/app/(dashboard)/page.tsx`)**: Se ha sumado el panel "Centro de Alertas de Cobranzas" en la consola administrativa superior con accesos directos al módulo.
*   **Visualización en Clientes (`src/app/(dashboard)/clientes/page.tsx`)**: Un banner superior resume las alertas críticas para agilizar la labor diaria.

## 2. Sección de Configuración de Cobranzas
Nueva pestaña en Clientes para parametrizar las automatizaciones locales:
*   **Avisos Preventivos**: Días de antelación para alertas preventivas de vencimiento.
*   **Monto Mínimo**: Umbral en pesos para marcar deuda como prioritaria/crítica.
*   **Días de Mora**: Límite de días permitidos antes de clasificar como mora crítica.
*   **Plantillas Editables**: Formularios para ajustar el cuerpo de los correos electrónicos y mensajes de WhatsApp.
*   **Consola de Audio**: Activar/desactivar audio y slider interactivo para ajustar el volumen de salida.

## 3. Síntesis de Sonido Profesional
Implementado mediante la **Web Audio API** (`playSystemSound` en `utils.ts`), generando ondas senoidales breves sin recurrir a recursos externos:
*   `pago`: Arpegio ascendente brillante (`C5 -> E5 -> G5`) al registrar un cobro parcial.
*   `regularizado`: Acorde dulce ascendente agudo (`D5 -> A5 -> D6`) cuando un cliente salda su saldo completo (0).
*   `deudor` / `vencido`: Señales dobles y descensos de tono discretos de advertencia.
*   `recordatorio`: Chirrido agudo rápido de confirmación al registrar gestiones.

## 4. Historial de Gestiones y Acciones Sugeridas
*   **Ficha Contable**: Si el cliente tiene saldo deudor, el modal despliega sugerencias de contacto rápido (WhatsApp pre-cargado, Email corporativo con cuerpo automático, registrar llamada telefónica o registrar promesa de pago).
*   **Registro de Gestiones**: Una nueva sub-pestaña "Historial de Gestiones" lista las interacciones previas del cliente (WhatsApp, Email, Promesa de pago) y permite ingresar nuevas acciones de seguimiento.
*   **Cobro Integrado**: Un botón "Registrar Cobro" en la tabla de comprobantes pendientes permite cobrar facturas individuales, lo que recalcula saldos, genera alertas de regularización, asienta el historial y reproduce el chime de audio correspondiente de manera inmediata.

---

## Verificación Local
*   **Compilación exitosa** (`npm run build`).
*   **Tests exitosos** (`npx vitest run`) confirmando la integridad del sistema.
