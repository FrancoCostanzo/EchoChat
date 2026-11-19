// Genera un par de claves VAPID para las notificaciones push.
// Uso:  npm run vapid
//
// Se corre una sola vez por instalación y las claves se copian al .env. Si se
// cambian después, las suscripciones existentes dejan de servir.

import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

process.stdout.write(
  [
    '# Copie estas líneas en el .env del backend (o el .env de Docker):',
    `VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${privateKey}`,
    '',
  ].join('\n'),
);
