'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Usuario o contraseña incorrectos.');
      }

      // Redirigir al dashboard tras persistir la cookie exitosamente en el navegador
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el servidor.');
    } finally {
      setIsPending(false);
    }
  };

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
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Nombre de Usuario o Email"
              name="username"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. dmoyano"
              required
              autoFocus
            />
            <Input
              label="Contraseña"
              name="password"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs font-semibold rounded-lg">
                ⚠️ {error}
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
