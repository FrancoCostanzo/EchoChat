import pino from 'pino';
import config from '../config';

const logger = pino({
  level: config.log.level,
  ...(config.env === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    },
  }),
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]',
  },
});

// `export =` por lo mismo que en config/index.ts: el resto del backend hace
// `const logger = require('../config/logger')` y espera la instancia directa.
export = logger;
