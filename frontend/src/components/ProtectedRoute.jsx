import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import AppLogo from '@/components/AppLogo';

export default function ProtectedRoute({ children }) {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <AppLogo size="sm" withGlow />
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
