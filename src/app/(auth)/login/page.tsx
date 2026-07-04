'use client';

import React, { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl animate-fade-in">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <img src="/logo.png" alt="M&S Logo" className="h-16 w-auto object-contain" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-slate-100 mt-2">
            M&S Tecnología Digital
          </CardTitle>
          <CardDescription className="text-slate-400">
            M&S Tecnología Digital — Sistema Administrativo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            <Input
              label="Nombre de Usuario"
              name="username"
              id="username"
              placeholder="e.g. dmoyano"
              required
              autoFocus
            />
            <Input
              label="Contraseña"
              name="password"
              id="password"
              type="password"
              placeholder="••••••••"
              required
            />

            {state?.error && (
              <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs font-semibold rounded-lg">
                ⚠️ {state.error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full font-semibold py-2.5"
              disabled={isPending}
            >
              {isPending ? 'Iniciando Sesión...' : 'Ingresar al Sistema'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
