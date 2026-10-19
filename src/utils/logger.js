const pino = require("pino");
const config = require("@bedrockio/config");

const logger = pino({ level: config.get("LOG_LEVEL") });

function loggingMiddleware() {
  return async (ctx, next) => {
    const start = Date.now();
    ctx.logger = logger;
    try {
      await next();
    } finally {
      logger.info(
        {
          method: ctx.method,
          path: ctx.path,
          status: ctx.status,
          durationMs: Date.now() - start,
        },
        "request",
      );
    }
  };
}

module.exports = { logger, loggingMiddleware };
