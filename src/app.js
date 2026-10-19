const { Router } = require("@koa/router");
const Koa = require("koa");
const { koaBody } = require("koa-body");
const validate = require("./utils/middleware/validate");
const errorHandler = require("./utils/middleware/error-handler");
const Sentry = require("@sentry/node");
const { version } = require("../package.json");
const config = require("@bedrockio/config");
const { loggingMiddleware } = require("./utils/logger");

const Joi = require("joi");

const { getBrowser, getPageCount } = require("./utils/browser");

const app = new Koa();

if (
  config.get("SENTRY_DSN") &&
  !["test", "development"].includes(process.env.ENV_NAME)
) {
  Sentry.init({
    dsn: config.get("SENTRY_DSN"),
    environment: process.env.ENV_NAME,
  });
}

app
  .use(koaBody({ multipart: true, jsonLimit: config.get("BODY_LIMIT") }))
  .use(loggingMiddleware())
  .use(errorHandler);

const router = new Router();
app.router = router;

async function render(html, base64, print) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const content = base64
      ? Buffer.from(html, "base64").toString("utf8")
      : html;
    await page.setContent(content, { waitUntil: "load" });
    await page.evaluate("document.fonts.ready.then(() => true)");
    const result = await print(page);
    return typeof result === "string" ? result : Buffer.from(result);
  } finally {
    await page.close();
  }
}

router.get("/", (ctx) => {
  ctx.body = {
    environment: config.get("ENV_NAME"),
    version,
    servedAt: new Date(),
  };
});

router.get("/check-status", async (ctx) => {
  ctx.body = {
    pageCount: await getPageCount(),
  };
});

// https://pptr.dev/api/puppeteer.screenshotoptions
router.post(
  "/1/screenshot",
  validate({
    body: Joi.object({
      html: Joi.string().required(),
      base64: Joi.boolean().default(false),
      export: Joi.object({
        scale: Joi.number().min(0.1).max(2).default(1),
        type: Joi.string().valid("jpeg", "png", "webp").default("png"),
        quality: Joi.number().min(0).max(100).default(100),
        fullPage: Joi.boolean().default(true),
        clip: Joi.object({
          x: Joi.number(),
          y: Joi.number(),
          width: Joi.number(),
          height: Joi.number(),
        }),
        omitBackground: Joi.boolean().default(false),
        encoding: Joi.string().valid("base64", "binary").default("binary"),
      }).default(),
    }),
  }),
  async (ctx) => {
    const body = ctx.request.body;
    const options = body.export;
    if (options.type === "png") {
      delete options.quality;
    }
    ctx.body = await render(body.html, body.base64, (page) =>
      page.screenshot(options),
    );
    ctx.type =
      options.encoding === "base64" ? "text/plain" : `image/${options.type}`;
  },
);

// https://pptr.dev/api/puppeteer.pdfoptions
router.post(
  "/1/pdf",
  validate({
    body: Joi.object({
      html: Joi.string().required(),
      base64: Joi.boolean().default(false),
      export: Joi.object({
        scale: Joi.number().default(1),
        displayHeaderFooter: Joi.boolean().default(false),
        headerTemplate: Joi.string(),
        footerTemplate: Joi.string(),
        printBackground: Joi.boolean().default(true),
        landscape: Joi.boolean().default(false),
        pageRanges: Joi.string(),
        width: Joi.string(),
        height: Joi.string(),
        format: Joi.string()
          .valid(
            "Letter",
            "Legal",
            "Tabloid",
            "Ledger",
            "A0",
            "A1",
            "A2",
            "A3",
            "A4",
            "A5",
            "A6",
          )
          .default("Letter"),
        margin: Joi.object({
          top: Joi.string().default(0),
          right: Joi.string().default(0),
          bottom: Joi.string().default(0),
          left: Joi.string().default(0),
        }),
        preferCSSPageSize: Joi.boolean().default(true),
      }).default(),
    }),
  }),
  async (ctx) => {
    const body = ctx.request.body;
    ctx.body = await render(body.html, body.base64, (page) =>
      page.pdf(body.export),
    );
    ctx.type = "application/pdf";
  },
);

app.use(router.routes());
app.use(router.allowedMethods());

app.on("error", (err, ctx) => {
  // dont output stacktraces of errors that is throw with status as they are known
  if (!err.status || err.status === 500) {
    ctx.logger.error(err);
    Sentry.withScope((scope) => {
      scope.setContext("http", { method: ctx.method, url: ctx.url });
      Sentry.captureException(err);
    });
  }
});

module.exports = app;
