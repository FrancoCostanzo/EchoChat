import type { Request, Response, NextFunction } from 'express';
import scimService from '../services/scim.service';
import { toScimUser, listResponse, sendScim, scimError, scimBaseUrl } from '../utils/scim';
import { AppError } from '../errors';
import { qStr } from '../types/http';

function ctxOf(req: Request) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

class ScimController {
  // Capacidades del proveedor; algunos IdPs lo consultan antes de aprovisionar.
  serviceProviderConfig(req: Request, res: Response) {
    sendScim(res, 200, {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      documentationUri: `${scimBaseUrl(req)}`,
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Autenticación por bearer token estático.',
        },
      ],
      meta: { resourceType: 'ServiceProviderConfig', location: `${scimBaseUrl(req)}/ServiceProviderConfig` },
    });
  }

  async listUsers(req: Request, res: Response) {
    const startIndex = Math.max(1, parseInt(String(req.query.startIndex ?? ''), 10) || 1);
    const count = Math.min(200, Math.max(0, parseInt(String(req.query.count ?? ''), 10) || 100));
    const { rows, total } = await scimService.list({ filter: qStr(req.query.filter), startIndex, count });
    sendScim(res, 200, listResponse(rows.map((u) => toScimUser(u, req)), { total, startIndex, count }));
  }

  async getUser(req: Request, res: Response) {
    const user = await scimService.getById(req.params.id);
    sendScim(res, 200, toScimUser(user, req));
  }

  async createUser(req: Request, res: Response) {
    const user = await scimService.create(req.body, ctxOf(req));
    sendScim(res, 201, toScimUser(user, req));
  }

  async replaceUser(req: Request, res: Response) {
    const user = await scimService.replace(req.params.id, req.body, ctxOf(req));
    sendScim(res, 200, toScimUser(user, req));
  }

  async patchUser(req: Request, res: Response) {
    const user = await scimService.patch(req.params.id, req.body, ctxOf(req));
    sendScim(res, 200, toScimUser(user, req));
  }

  async deleteUser(req: Request, res: Response) {
    await scimService.remove(req.params.id, ctxOf(req));
    res.status(204).end();
  }

  // Groups: no gestionamos grupos por SCIM en esta fase; devolvemos lista vacía para
  // que los IdPs que sondean /Groups no fallen.
  listGroups(req: Request, res: Response) {
    sendScim(res, 200, listResponse([], { total: 0, startIndex: 1, count: 0 }));
  }
}

// Traduce errores de la app al formato de error de SCIM.
function scimErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const scimType = err.statusCode === 409 ? 'uniqueness' : undefined;
    return scimError(res, err.statusCode, err.message, scimType);
  }
  if ((err as { code?: string })?.code === '23505') {
    return scimError(res, 409, 'El recurso ya existe', 'uniqueness');
  }
  return scimError(res, 500, 'Error interno del servidor');
}

export { scimErrorHandler };
export const scimController = new ScimController();
