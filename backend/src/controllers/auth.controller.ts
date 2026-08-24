import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authService, userService, oidcService } from '../services';
import { toUserResponse } from '../models';
import config from '../config';
import logger from '../config/logger';
import { setTransaction, readAndClearTransaction } from '../utils/ssoTransaction';
import type { AuthRequest } from '../types/http';

// Base del frontend a la que vuelve el navegador tras el SSO.
//
// Sale sólo de OIDC_FRONTEND_URL y ya no cae a CORS_ORIGIN: desde que este
// último es una lista (con la web, la app de escritorio y lo que agregue cada
// despliegue), su primer elemento no es una respuesta razonable a "¿a qué URL
// mando el navegador?". Sin OIDC_FRONTEND_URL el redirect queda relativo.
function frontendBase(): string {
  return (config.oidc.frontendUrl || '').replace(/\/$/, '');
}

/**
 * Deep link por el que vuelve el SSO cuando lo inició la app de escritorio.
 * El esquema lo registra el proceso principal de Electron
 * (ver desktop/src/main/deepLink.ts); tiene que coincidir con esta constante.
 */
const DESKTOP_CALLBACK = 'echochat://auth/callback';

class AuthController {
  async register(req: Request, res: Response) {
    const user = await authService.register(req.body, req.ip, req.get('user-agent'));
    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: toUserResponse(user),
    });
  }

  async registrationStatus(req: Request, res: Response) {
    const allow = await authService.isRegistrationAllowed();
    res.json({ status: 'success', data: { allow_registration: allow } });
  }

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body, req.ip, req.get('user-agent'));

    if ('requires_2fa' in result) {
      return res.json({
        status: 'success',
        data: { requires_2fa: true, temp_token: result.temp_token },
      });
    }

    const user = await userService.getProfile(result.user.id);
    res.json({
      status: 'success',
      data: {
        user,
        token: result.token,
        expires_at: result.expires_at,
      },
    });
  }

  // ── SSO / OIDC ───────────────────────────────────────────────────────────────

  // Proveedores habilitados para pintar los botones del login (público, sin secretos).
  async ssoProviders(req: Request, res: Response) {
    res.json({ status: 'success', data: { providers: oidcService.listProviders() } });
  }

  // Inicia el login: genera la transacción, la guarda en cookie y redirige al IdP.
  //
  // `?client=desktop&dstate=...` lo agrega la app de escritorio al abrir el
  // navegador del sistema; queda en la cookie para que el callback sepa por
  // dónde volver (ver ssoCallback).
  async ssoLogin(req: Request, res: Response) {
    const { url, transaction } = await oidcService.buildAuthRequest(req.params.provider, req);

    const isDesktop = req.query.client === 'desktop';
    const dstate = typeof req.query.dstate === 'string' ? req.query.dstate.slice(0, 128) : undefined;

    setTransaction(res, isDesktop ? { ...transaction, client: 'desktop', dstate } : transaction);
    res.redirect(url);
  }

  // Callback del IdP: valida, hace login (JIT) y vuelve al frontend con el token en
  // el fragmento (#) para que no quede en logs ni en el header Referer.
  async ssoCallback(req: Request, res: Response) {
    const provider = req.params.provider;
    const base = frontendBase();
    // Se lee antes del try para poder mandar el error por el mismo canal por el
    // que vino el login: si la app de escritorio abrió el navegador, tirarla de
    // vuelta al frontend web la dejaría esperando para siempre.
    const transaction = readAndClearTransaction(req, res);
    const isDesktop = transaction?.client === 'desktop';

    try {
      if (!transaction || transaction.provider !== provider) {
        throw new Error('SSO transaction missing or mismatched');
      }
      const claims = await oidcService.handleCallback(provider, req, transaction);
      const result = await authService.loginWithClaims(
        claims,
        provider,
        { device_type: isDesktop ? 'desktop' : 'web' },
        req.ip,
        req.get('user-agent'),
      );
      const fragment = new URLSearchParams({
        token: result.token,
        expires_at: new Date(result.expires_at).toISOString(),
        ...(transaction.dstate ? { dstate: transaction.dstate } : {}),
      }).toString();

      res.redirect(isDesktop ? `${DESKTOP_CALLBACK}#${fragment}` : `${base}/auth/callback#${fragment}`);
    } catch (err) {
      logger.warn({ err: (err as Error).message, provider }, 'SSO login failed');
      res.redirect(isDesktop ? `${DESKTOP_CALLBACK}#sso_error=1` : `${base}/login?sso_error=1`);
    }
  }

  async logout(req: AuthRequest, res: Response) {
    // El hash ya lo resolvió `authenticate` al validar el token, y viene en la
    // sesión: sacarlo de ahí evita volver a parsear el header y hashear de nuevo.
    await authService.logout(req.user.id, req.session.token_hash);
    res.json({ status: 'success', message: 'Logged out' });
  }

  async logoutAll(req: AuthRequest, res: Response) {
    // keepCurrent=true revokes all OTHER sessions but keeps the current one active
    const keepCurrent = req.query.keepCurrent === 'true';
    const exceptId = keepCurrent ? req.session?.id : null;
    await authService.logoutAll(req.user.id, exceptId);
    res.json({ status: 'success', message: 'Sessions revoked' });
  }

  async me(req: AuthRequest, res: Response) {
    const user = await userService.getProfile(req.user.id);
    res.json({
      status: 'success',
      data: user,
    });
  }

  async changePassword(req: AuthRequest, res: Response) {
    await authService.changePassword(
      req.user.id,
      req.body.current_password,
      req.body.new_password,
      req.ip,
      req.get('user-agent')
    );
    res.json({ status: 'success', message: 'Password changed' });
  }

  async getSessions(req: AuthRequest, res: Response) {
    const sessions = await authService.getSessions(req.user.id);
    const currentSessionId = req.session?.id;
    const data = sessions.map((s) => ({ ...s, is_current: s.id === currentSessionId }));
    res.json({ status: 'success', data });
  }

  async revokeSession(req: AuthRequest, res: Response) {
    await authService.revokeSession(req.user.id, req.params.sessionId);
    res.json({ status: 'success', message: 'Session revoked' });
  }

  // ── 2FA ────────────────────────────────────────────────────────────────────

  async setup2fa(req: AuthRequest, res: Response) {
    const result = await authService.setupTotp(req.user.id);
    res.json({ status: 'success', data: result });
  }

  async enable2fa(req: AuthRequest, res: Response) {
    const result = await authService.enableTotp(req.user.id, req.body.code);
    res.json({ status: 'success', data: result });
  }

  async disable2fa(req: AuthRequest, res: Response) {
    await authService.disableTotp(req.user.id, req.body.password, req.body.code);
    res.json({ status: 'success', message: '2FA disabled' });
  }

  async verify2faChallenge(req: Request, res: Response) {
    const result = await authService.verifyTotpChallenge(
      {
        tempToken: req.body.temp_token,
        code: req.body.code,
        deviceName: req.body.device_name,
        deviceType: req.body.device_type,
      },
      req.ip,
      req.get('user-agent')
    );
    const user = await userService.getProfile(result.user.id);
    res.json({
      status: 'success',
      data: { user, token: result.token, expires_at: result.expires_at },
    });
  }

  async regenerateBackupCodes(req: AuthRequest, res: Response) {
    const result = await authService.regenerateBackupCodes(req.user.id, req.body.code);
    res.json({ status: 'success', data: result });
  }
}

export default new AuthController();
