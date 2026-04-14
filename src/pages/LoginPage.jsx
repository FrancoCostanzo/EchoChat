import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Input, Button, Separator, Spinner } from '@heroui/react';
import { MessageCircle, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form);
      navigate('/chat');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="flex min-h-screen items-center justify-center bg-default-50 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">EchoChat</h1>
          <p className="text-sm text-default-500">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger">{error}</div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Usuario</label>
            <Input
              placeholder="tu.usuario"
              value={form.username}
              onChange={updateField('username')}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Contraseña</label>
            <div className="relative">
              <Input
                placeholder="••••••••"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={updateField('password')}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-default-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button type="submit" isPending={loading} className="mt-2">
            {({isPending}) => isPending ? <><Spinner size="sm" /> Ingresando...</> : 'Iniciar sesión'}
          </Button>
        </form>

        <Separator className="my-6" />

        <p className="text-center text-sm text-default-500">
          ¿No tenés cuenta?{' '}
          <Link to="/register" className="text-primary font-medium">
            Registrate
          </Link>
        </p>
      </Card>
    </div>
  );
}
