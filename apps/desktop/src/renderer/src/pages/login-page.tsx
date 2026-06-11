import { AuthShell } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import { LoaderCircle, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : 'No fue posible iniciar sesión.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Acceso seguro"
      title="Bienvenido de nuevo"
      description="Ingresa con las credenciales asignadas por el administrador de la clínica."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Correo electrónico
          </span>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              autoFocus
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@clinica.com"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Contraseña
          </span>
          <PasswordInput
            autoComplete="current-password"
            required
            minLength={10}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Ingresa tu contraseña"
          />
        </label>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full bg-teal-600 text-white hover:bg-teal-700"
        >
          {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
          {isSubmitting ? 'Verificando...' : 'Iniciar sesión'}
        </Button>
      </form>
    </AuthShell>
  );
}
