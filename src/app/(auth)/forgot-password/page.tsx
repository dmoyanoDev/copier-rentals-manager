'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [identity, setIdentity] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity.trim()) return;

    setIsLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: identity.trim() }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error inesperado.');
      }
      
      setMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
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
            Recuperar Contraseña
          </CardTitle>
          <CardDescription className="text-slate-400">
            Ingresa tu usuario o correo electrónico para recibir un enlace de restablecimiento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-lg">
                ✓ {message}
              </div>
              <Link href="/login" className="block">
                <Button variant="secondary" className="w-full font-semibold py-2">
                  Volver al Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Usuario o Email"
                name="identity"
                id="identity"
                placeholder="e.g. dmoyano o dmoyano@mstecnologia.com.ar"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                required
                autoFocus
              />

              {error && (
                <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs font-semibold rounded-lg">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <Button
                  type="submit"
                  className="w-full font-semibold py-2.5"
                  disabled={isLoading}
                >
                  {isLoading ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
                </Button>
                
                <Link href="/login" className="text-center text-xs text-slate-450 hover:text-slate-300 transition-colors py-1">
                  Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
