import { z } from 'zod';

export const machineFormSchema = z.object({
  id: z.string().optional(),
  brand: z.string().min(1, 'La marca es obligatoria'),
  model: z.string().min(1, 'El modelo es obligatorio'),
  serial: z.string().min(1, 'El número de serie es obligatorio'),
  type: z.string().min(1, 'El tipo es obligatorio'), // e.g. 'Monocromática', 'Color'
  status: z.string().min(1, 'El estado es obligatorio'), // e.g. 'Nuevo', 'Usado', 'Scrap', 'No funciona'
  machineCounter: z.number().int().nonnegative('El contador de copias debe ser mayor o igual a 0'),
  clientId: z.string().optional().or(z.literal('')),
  abonoId: z.string().optional().or(z.literal('')),
  installationDate: z.string().optional().or(z.literal('')),
  initialCounter: z.number().int().nonnegative('El contador inicial debe ser mayor o igual a 0').default(0),
  applyIva: z.boolean().default(false),
  readingDay: z.number().int().min(1).max(31).default(10),
  isAvailable: z.boolean().default(true),
  pdfUrl: z.string().optional().or(z.literal('')),
  features: z.string().optional().or(z.literal('')),
});

export type MachineFormValues = z.infer<typeof machineFormSchema>;
