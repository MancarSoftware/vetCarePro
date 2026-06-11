import { AuthShell } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import { LoaderCircle, Mail, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';

export function SetupPage() {
  const { initialize } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    try {
      await initialize({ firstName, lastName, email, password });
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : 'No fue posible completar la configuración.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Primera configuración"
      title="Crea la cuenta administradora"
      description="Esta cuenta tendrá acceso completo para configurar la clínica y crear al resto del equipo."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Nombre
            </span>
            <div className="relative">
              <UserRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                required
                minLength={2}
                maxLength={80}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Apellido
            </span>
            <input
              required
              minLength={2}
              maxLength={80}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Correo electrónico
          </span>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="administrador@clinica.com"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Contraseña
          </span>
          <PasswordInput
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 10 caracteres"
          />
          <p className="mt-2 text-xs text-slate-400">
            Incluye mayúscula, minúscula y número.
          </p>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Confirmar contraseña
          </span>
          <PasswordInput
            autoComplete="new-password"
            required
            minLength={10}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="Repite la contraseña"
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
          className="mt-2 h-11 w-full bg-teal-600 text-white hover:bg-teal-700"
        >
          {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
          {isSubmitting ? 'Creando cuenta...' : 'Configurar VetCare Pro'}
        </Button>
      </form>
    </AuthShell>
  );
}

