import { Client } from 'ldapts';
import config from '../config';
import logger from '../config/logger';
import { BadRequestError, AppError } from '../errors';

/** Entrada del directorio ya mapeada a la forma que usa la base. */
export interface LdapUser {
  external_id: string | null;
  username: string | null;
  display_name: string | null;
  email: string | null;
  department: string | null;
  job_title: string | null;
  groups: string[];
  is_disabled: boolean;
  dn: string;
}

/**
 * Entrada ya filtrada por `fetchAllUsers`: tiene los identificadores que el
 * upsert exige sí o sí. El filtro sólo mira username y external_id porque
 * display_name cae a rawUsername cuando el directorio no lo trae (ver
 * `_mapEntry`), así que si hay username hay display_name.
 */
export type LdapUserImportable = LdapUser & {
  external_id: string;
  username: string;
  display_name: string;
};

function esImportable(u: LdapUser): u is LdapUserImportable {
  return Boolean(u.username && u.external_id && u.display_name);
}

/** Los atributos de una entrada llegan como string, Buffer o arrays de ambos. */
type LdapValue = string | Buffer | (string | Buffer)[] | undefined | null;
type LdapEntry = { dn: string } & Record<string, any>;

// Caracteres válidos para un username local: el directorio puede traer cosas con
// espacios o mayúsculas, así que normalizamos a lo que aceptan nuestros DTOs.
function sanitizeUsername(raw: unknown): string | null {
  if (!raw) return null;
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.|\.$/g, '');
}

// objectGUID (AD) y entryUUID/objectGUID binarios llegan como Buffer; los demás
// como string. Serializamos a hex para tener un id estable y comparable.
function normalizeExternalId(value: LdapValue): string | null {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (Array.isArray(value)) return normalizeExternalId(value[0]);
  return String(value);
}

function firstValue(value: LdapValue) {
  if (Array.isArray(value)) return value[0];
  return value;
}

class LdapService {
  isEnabled(): boolean {
    return Boolean(config.ldap.enabled && config.ldap.url && config.ldap.baseDn);
  }

  status() {
    const enabled = this.isEnabled();
    return {
      enabled,
      base_dn: enabled ? config.ldap.baseDn : null,
      url: enabled ? config.ldap.url : null,
      sync_enabled: config.ldap.syncEnabled,
      sync_cron: config.ldap.syncCron,
      deprovision: config.ldap.deprovision,
      sync_roles: config.ldap.syncRoles,
    };
  }

  _assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new BadRequestError('La integración LDAP no está habilitada o está mal configurada');
    }
  }

  _newClient(): Client {
    return new Client({
      url: config.ldap.url,
      timeout: config.ldap.timeoutMs,
      connectTimeout: config.ldap.timeoutMs,
      tlsOptions: { rejectUnauthorized: config.ldap.tlsRejectUnauthorized },
    });
  }

  // Mapea una entrada del directorio a la forma que usa nuestra BD.
  _mapEntry(entry: LdapEntry): LdapUser {
    const { attr } = config.ldap;
    const rawUsername = firstValue(entry[attr.username]);
    const username = sanitizeUsername(rawUsername);
    const externalId = normalizeExternalId(entry[attr.externalId]) || (username ? `dn:${entry.dn}` : null);
    const displayName = firstValue(entry[attr.displayName]) || rawUsername || username;
    return {
      external_id: externalId,
      username,
      display_name: displayName ? String(displayName).slice(0, 100) : null,
      email: (firstValue(entry[attr.email]) as string) || null,
      department: (firstValue(entry[attr.department]) as string) || null,
      job_title: (firstValue(entry[attr.jobTitle]) as string) || null,
      groups: this._asArray(entry[attr.memberOf]).map(String),
      is_disabled: this._isAccountDisabled(entry[attr.accountControl]),
      dn: entry.dn,
    };
  }

  _asArray(value: LdapValue): (string | Buffer)[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }

  // AD codifica el estado de la cuenta en userAccountControl; el bit ACCOUNTDISABLE
  // (0x2) indica cuenta deshabilitada. Otros directorios no lo traen → false.
  _isAccountDisabled(value: LdapValue): boolean {
    const raw = firstValue(value);
    if (raw == null) return false;
    const uac = parseInt(String(raw), 10);
    return Number.isFinite(uac) && (uac & 0x2) === 0x2;
  }

  // Traduce los grupos (memberOf) del usuario a nombres de rol de EchoChat según
  // config.ldap.groupRoleMap. Devuelve roles únicos; vacío si no hay mapeo aplicable.
  mapGroupsToRoles(groups: LdapValue): string[] {
    const map = config.ldap.groupRoleMap || {};
    const roles = new Set<string>();
    for (const dn of this._asArray(groups)) {
      const role = map[String(dn).trim().toLowerCase()];
      if (role) roles.add(role);
    }
    return [...roles];
  }

  _attributeList(): string[] {
    const { attr } = config.ldap;
    // dn siempre viene; pedimos el resto explícitamente para no traer todo el objeto.
    return [...new Set(Object.values(attr))];
  }

  // Bind con la cuenta de servicio, busca al usuario y verifica su contraseña
  // re-bindeando como su DN. Devuelve los atributos mapeados o `null` si las
  // credenciales no son válidas.
  async authenticate(username: string, password: string): Promise<LdapUser | null> {
    this._assertEnabled();
    if (!password) return null; // un bind con password vacía es un "unauthenticated bind" → lo rechazamos

    const searchClient = this._newClient();
    let userEntry: LdapEntry | null;
    try {
      await searchClient.bind(config.ldap.bindDn, config.ldap.bindPassword);
      const filter = config.ldap.userFilter.replace(/\{\{username\}\}/g, this._escapeFilter(username));
      const { searchEntries } = await searchClient.search(config.ldap.baseDn, {
        scope: 'sub',
        filter,
        attributes: this._attributeList(),
        sizeLimit: 2,
      });
      userEntry = (searchEntries[0] as LdapEntry) || null;
    } catch (err) {
      logger.error({ err }, 'LDAP search failed during authentication');
      throw new AppError('No se pudo contactar al servidor LDAP', 502);
    } finally {
      await searchClient.unbind().catch(() => {});
    }

    if (!userEntry) return null;

    // Verificamos la contraseña con un bind como el usuario encontrado.
    const userClient = this._newClient();
    try {
      await userClient.bind(userEntry.dn, password);
    } catch {
      return null; // credenciales inválidas
    } finally {
      await userClient.unbind().catch(() => {});
    }

    return this._mapEntry(userEntry);
  }

  // Trae todos los usuarios del directorio bajo baseDn que matcheen userFilter.
  async fetchAllUsers(): Promise<LdapUserImportable[]> {
    this._assertEnabled();
    const client = this._newClient();
    try {
      await client.bind(config.ldap.bindDn, config.ldap.bindPassword);
      // En fetch no hay {{username}}, así que lo quitamos si quedó en el filtro base.
      const filter = config.ldap.userFilter.replace(/\([^()]*\{\{username\}\}[^()]*\)/g, '');
      const safeFilter = filter.trim() || '(objectClass=person)';
      const { searchEntries } = await client.search(config.ldap.baseDn, {
        scope: 'sub',
        filter: safeFilter,
        attributes: this._attributeList(),
        paged: true,
      });
      return searchEntries
        .map((e) => this._mapEntry(e as LdapEntry))
        .filter(esImportable);
    } catch (err) {
      logger.error({ err }, 'LDAP fetchAllUsers failed');
      throw new AppError('No se pudo importar desde el servidor LDAP', 502);
    } finally {
      await client.unbind().catch(() => {});
    }
  }

  // Escapa los metacaracteres de un filtro LDAP (RFC 4515) en la entrada del usuario.
  _escapeFilter(input: string): string {
    return String(input).replace(/[\\*()\0]/g, (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
  }
}

export default new LdapService();
