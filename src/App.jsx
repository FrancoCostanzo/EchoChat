import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spinner } from '@heroui/react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useThemeStore } from '@/stores/themeStore';
import ProtectedRoute from '@/components/ProtectedRoute';

const ChatLayout = lazy(() => import('@/layouts/ChatLayout'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const EmptyChat = lazy(() => import('@/pages/EmptyChat'));
const ConversationPage = lazy(() => import('@/pages/ConversationPage'));
const NewConversationPage = lazy(() => import('@/pages/NewConversationPage'));
const ContactsPage = lazy(() => import('@/pages/ContactsPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export default function App() {
  const init = useAuthStore((s) => s.init);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);
  const token = useAuthStore((s) => s.token);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const initSocket = useChatStore((s) => s.initSocket);
  const destroySocket = useChatStore((s) => s.destroySocket);
  const initTheme = useThemeStore((s) => s.init);

  useEffect(() => {
    init();
    return initTheme();
  }, [init, initTheme]);

  useEffect(() => {
    if (isAuthenticated && !loading) {
      fetchConversations();
      if (token) initSocket(token);
      return () => destroySocket();
    }
  }, [isAuthenticated, loading, fetchConversations, token, initSocket, destroySocket]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          element={
            <ProtectedRoute>
              <ChatLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/chat" element={<EmptyChat />} />
          <Route path="/chat/new" element={<NewConversationPage />} />
          <Route path="/chat/:conversationId" element={<ConversationPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </Suspense>
  );
}
