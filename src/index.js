const puppeteer = require("puppeteer");
const { CodementorJobBot } = require("./scraper");
require("dotenv").config();

(async () => {
  const bot = new CodementorJobBot({
    email: process.env.CODEMENTOR_EMAIL,
    password: process.env.CODEMENTOR_PASSWORD,
    headless: false, // Set to true for production
    slowMo: 100, // Slow down actions for debugging
  });

  try {
    await bot.initialize();
    await bot.login();

    // Start monitoring for new job requests
    await bot.monitorJobRequests({
      checkInterval: 30000, // Check every 30 seconds
      maxApplicationsPerHour: 50, // Apply to up to 50 jobs per hour
      skillsFilter: [
        "javascript",
        "airtable",
        "aws",
        "node.js",
        "react",
        "python",
        "ai",
        "mobile",
        "html",
        "css",
      ],
      minBudget: 0,
    });
  } catch (error) {
    console.error("Error running bot:", error);
  } finally {
    await bot.cleanup();
  }
})();
