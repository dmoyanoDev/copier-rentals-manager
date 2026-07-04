import { z } from 'zod';

export const clientFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().optional(),
  email: z.string().email('El formato del email es inválido').or(z.literal('')),
  address: z.string().optional(),
  cuit: z.string().regex(/^\d{11}$/, 'El CUIT debe contener exactamente 11 números').or(z.literal('')),
  notes: z.string().optional(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;
