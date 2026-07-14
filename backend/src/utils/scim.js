// Helpers de formato para SCIM 2.0 (RFC 7643/7644): esquemas, mapeo user↔SCIM,
// respuestas de lista y errores. Todo lo que sale usa content-type application/scim+json.

const SCHEMA_USER = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCHEMA_LIST = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const SCHEMA_ERROR = 'urn:ietf:params:scim:api:messages:2.0:Error';
const SCHEMA_PATCH = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';

const CONTENT_TYPE = 'application/scim+json';

function scimBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}/scim/v2`;
}

// Guardamos el externalId del IdP como "scim:<externalId>" en users.external_id;
// acá lo recuperamos crudo para exponerlo en la representación SCIM.
function stripScimPrefix(externalId) {
  if (!externalId) return undefined;
  return externalId.startsWith('scim:') ? externalId.slice(5) : externalId;
}

// Mapea una fila de `users` a un recurso User de SCIM.
function toScimUser(user, req) {
  const parts = (user.display_name || '').trim().split(/\s+/).filter(Boolean);
  const givenName = parts[0];
  const familyName = parts.slice(1).join(' ');
  return {
    schemas: [SCHEMA_USER],
    id: user.id,
    ...(user.external_id ? { externalId: stripScimPrefix(user.external_id) } : {}),
    userName: user.username,
    ...(user.display_name
      ? {
          name: {
            formatted: user.display_name,
            ...(givenName ? { givenName } : {}),
            ...(familyName ? { familyName } : {}),
          },
          displayName: user.display_name,
        }
      : {}),
    ...(user.email ? { emails: [{ value: user.email, primary: true }] } : {}),
    active: user.status === 'active',
    meta: {
      resourceType: 'User',
      ...(user.created_at ? { created: new Date(user.created_at).toISOString() } : {}),
      ...(user.updated_at ? { lastModified: new Date(user.updated_at).toISOString() } : {}),
      location: `${scimBaseUrl(req)}/Users/${user.id}`,
    },
  };
}

function listResponse(resources, { total, startIndex, count }) {
  return {
    schemas: [SCHEMA_LIST],
    totalResults: total,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
  };
}

function sendScim(res, status, body) {
  return res.status(status).type(CONTENT_TYPE).json(body);
}

function scimError(res, status, detail, scimType) {
  return sendScim(res, status, {
    schemas: [SCHEMA_ERROR],
    ...(scimType ? { scimType } : {}),
    status: String(status),
    detail,
  });
}

module.exports = {
  SCHEMA_USER,
  SCHEMA_LIST,
  SCHEMA_ERROR,
  SCHEMA_PATCH,
  CONTENT_TYPE,
  scimBaseUrl,
  toScimUser,
  listResponse,
  sendScim,
  scimError,
};
