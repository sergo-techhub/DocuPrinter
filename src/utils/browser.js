const puppeteer = require("puppeteer");

let browserPromise;

function launchBrowser() {
  return puppeteer
    .launch({
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=none",
        "--force-color-profile=srgb",
      ],
    })
    .then((browser) => {
      browser.on("disconnected", () => {
        browserPromise = undefined;
      });
      return browser;
    })
    .catch((error) => {
      browserPromise = undefined;
      throw error;
    });
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }
  return browserPromise;
}

async function closeBrowser() {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = undefined;
  await browser.close();
}

exports.getBrowser = getBrowser;
exports.closeBrowser = closeBrowser;

exports.getPageCount = async function getPageCount() {
  const browser = await getBrowser();
  const openPages = await browser.pages();
  return openPages.length;
};
