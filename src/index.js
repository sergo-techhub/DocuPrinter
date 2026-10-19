const { logger } = require("./utils/logger");
const app = require("./app");
const config = require("@bedrockio/config");
const { getBrowser, closeBrowser } = require("./utils/browser");

const PORT = config.get("BIND_PORT");
const HOST = config.get("BIND_HOST");

module.exports = (async () => {
  await getBrowser();

  const server = app.listen(PORT, HOST, () => {
    logger.info(`Started on port //${HOST}:${PORT}`);
  });

  const shutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down`);
    server.close(async () => {
      await closeBrowser();
      process.exit(0);
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return app;
})();
