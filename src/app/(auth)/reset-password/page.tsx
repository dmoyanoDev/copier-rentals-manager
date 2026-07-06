'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setError('Token de recuperación no válido o ausente.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
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

  if (!token) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs font-semibold rounded-lg">
          ⚠️ El enlace de restablecimiento es inválido o no contiene un token válido.
        </div>
        <Link href="/forgot-password" className="block">
          <Button variant="secondary" className="w-full font-semibold py-2">
            Solicitar Nueva Recuperación
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <CardContent className="space-y-4">
      {message ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-lg">
            ✓ {message}
          </div>
          <Link href="/login" className="block">
            <Button className="w-full font-semibold py-2">
              Ingresar al Sistema
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Nueva Contraseña"
            name="password"
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Confirmar Contraseña"
            name="confirmPassword"
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
            disabled={isLoading}
          >
            {isLoading ? 'Guardando...' : 'Guardar Nueva Contraseña'}
          </Button>
        </form>
      )}
    </CardContent>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl animate-fade-in">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <img src="/logo.png" alt="M&S Logo" className="h-16 w-auto object-contain" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-slate-100 mt-2">
            Restablecer Contraseña
          </CardTitle>
          <CardDescription className="text-slate-400">
            Ingresa tu nueva contraseña administrativa segura
          </CardDescription>
        </CardHeader>
        <Suspense fallback={<div className="text-center text-slate-400 p-6 text-xs animate-pulse">Cargando token de verificación...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </Card>
    </div>
  );
}
