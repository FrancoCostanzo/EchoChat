import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Input, Button, Separator } from '@heroui/react';
import { MessageCircle, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [form, setForm] = useState({
    username: '',
    display_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    job_title: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...data } = form;
      await register(data);
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Error al registrarse');
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
          <p className="text-sm text-default-500">Creá tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger">{error}</div>
          )}

          <Input
            label="Usuario"
            placeholder="tu.usuario"
            value={form.username}
            onChange={updateField('username')}
            isRequired
            autoFocus
          />

          <Input
            label="Nombre completo"
            placeholder="Juan Pérez"
            value={form.display_name}
            onChange={updateField('display_name')}
            isRequired
          />

          <Input
            label="Email"
            type="email"
            placeholder="juan@empresa.com"
            value={form.email}
            onChange={updateField('email')}
          />

          <div className="flex gap-3">
            <Input
              label="Departamento"
              placeholder="IT"
              value={form.department}
              onChange={updateField('department')}
              className="flex-1"
            />
            <Input
              label="Cargo"
              placeholder="Developer"
              value={form.job_title}
              onChange={updateField('job_title')}
              className="flex-1"
            />
          </div>

          <Input
            label="Contraseña"
            placeholder="••••••••"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={updateField('password')}
            isRequired
            endContent={
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-default-400">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          <Input
            label="Confirmar contraseña"
            placeholder="••••••••"
            type={showPassword ? 'text' : 'password'}
            value={form.confirmPassword}
            onChange={updateField('confirmPassword')}
            isRequired
          />

          <Button type="submit" color="primary" isLoading={loading} className="mt-2">
            Crear cuenta
          </Button>
        </form>

        <Separator className="my-6" />

        <p className="text-center text-sm text-default-500">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-primary font-medium">
            Iniciar sesión
          </Link>
        </p>
      </Card>
    </div>
  );
}
