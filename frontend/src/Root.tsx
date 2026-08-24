import { Suspense, lazy } from 'react';
import App from './App';
import { needsServerSetup } from './lib/runtimeConfig';

// Sólo se carga en Electron y sólo la primera vez: en la web `needsServerSetup()`
// es siempre false y este chunk nunca se pide.
const ServerSetupPage = lazy(() => import('./pages/ServerSetupPage'));

/**
 * Elige qué shell montar. Sin servidor configurado (primer arranque de la app
 * de escritorio) no hay API contra la que autenticarse, así que no se monta
 * `App`: nada de auth, sockets ni fetch de conversaciones.
 */
export default function Root() {
  if (needsServerSetup()) {
    return (
      <Suspense fallback={null}>
        <ServerSetupPage />
      </Suspense>
    );
  }

  return <App />;
}
