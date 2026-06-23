import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import MonitoreoDashboard from '@/components/monitoring/MonitoreoDashboard';

function useAdminAccess() {
  const user = useAuthStore((s) => s.user);
  const roles = user?.roles || [];
  const permissions = user?.permissions || [];
  return roles.includes('super_admin') || permissions.some((p) => p.startsWith('admin.'));
}

export default function MonitoringPage() {
  const canAccess = useAdminAccess();

  if (!canAccess) {
    return <Navigate to="/chat" replace />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <MonitoreoDashboard />
    </div>
  );
}
