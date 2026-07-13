const { Issuer, generators } = require('openid-client');
const config = require('../config');
const logger = require('../config/logger');
const { BadRequestError, AppError } = require('../errors');

// Normaliza un candidato a username local (mismo criterio que LDAP): minúsculas,
// sólo [a-z0-9._], sin puntos repetidos ni en los extremos.
function sanitizeUsername(raw) {
  if (!raw) return null;
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.|\.$/g, '');
}

class OidcService {
  constructor() {
    // Cache de clientes OIDC descubiertos, por nombre de proveedor.
    this._clients = new Map();
  }

  isEnabled() {
    return Boolean(config.oidc.enabled && Object.keys(config.oidc.providers).length > 0);
  }

  _getProviderConfig(name) {
    const provider = config.oidc.providers[String(name || '').toLowerCase()];
    if (!provider) throw new BadRequestError('Proveedor SSO desconocido o no configurado');
    return provider;
  }

  // Lista pública de proveedores para pintar los botones en el login (sin secretos).
  listProviders() {
    if (!this.isEnabled()) return [];
    return Object.values(config.oidc.providers).map((p) => ({ name: p.name, label: p.label }));
  }

  // redirect_uri que debe coincidir EXACTAMENTE con el registrado en el IdP.
  redirectUri(providerName, req) {
    const base = config.oidc.redirectBase
      || (req ? `${req.protocol}://${req.get('host')}` : '');
    return `${base.replace(/\/$/, '')}/api/auth/sso/${providerName}/callback`;
  }

  // Descubre el issuer (well-known) y crea el cliente OIDC. Cacheado por proveedor.
  async _getClient(name) {
    const cached = this._clients.get(name);
    if (cached) return cached;
    const cfg = this._getProviderConfig(name);
    let issuer;
    try {
      issuer = await Issuer.discover(cfg.issuer);
    } catch (err) {
      logger.error({ err, provider: name }, 'OIDC issuer discovery failed');
      throw new AppError('No se pudo contactar al proveedor de identidad', 502);
    }
    const client = new issuer.Client({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      response_types: ['code'],
    });
    this._clients.set(name, client);
    return client;
  }

  // Paso 1: genera el material de la transacción (state/nonce/PKCE) y la URL del IdP.
  async buildAuthRequest(providerName, req) {
    if (!this.isEnabled()) throw new BadRequestError('El SSO no está habilitado');
    const cfg = this._getProviderConfig(providerName);
    const client = await this._getClient(providerName);

    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    const url = client.authorizationUrl({
      scope: cfg.scopes,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      redirect_uri: this.redirectUri(providerName, req),
    });

    return { url, transaction: { provider: providerName, state, nonce, codeVerifier } };
  }

  // Paso 2: valida el callback contra el material guardado y devuelve claims mapeados.
  async handleCallback(providerName, req, transaction) {
    const client = await this._getClient(providerName);
    const params = client.callbackParams(req);
    let tokenSet;
    try {
      tokenSet = await client.callback(
        this.redirectUri(providerName, req),
        params,
        { state: transaction.state, nonce: transaction.nonce, code_verifier: transaction.codeVerifier }
      );
    } catch (err) {
      logger.warn({ err: err.message, provider: providerName }, 'OIDC callback validation failed');
      throw new BadRequestError('No se pudo validar la respuesta del proveedor de identidad');
    }

    const claims = tokenSet.claims();
    if (!claims.sub) throw new BadRequestError('El proveedor no devolvió un identificador de usuario');

    const rawUsername = claims.preferred_username
      || (claims.email ? claims.email.split('@')[0] : null)
      || claims.sub;
    const username = sanitizeUsername(rawUsername) || `user.${claims.sub}`.toLowerCase();

    return {
      // Namespaced para no colisionar entre proveedores ni con LDAP.
      external_id: `oidc:${providerName}:${claims.sub}`,
      username,
      display_name: (claims.name || rawUsername || username)?.toString().slice(0, 100) || null,
      email: claims.email || null,
    };
  }
}

module.exports = new OidcService();
