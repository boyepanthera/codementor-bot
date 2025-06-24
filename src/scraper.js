const puppeteer = require("puppeteer");

class CodementorJobBot {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
    this.appliedJobs = new Set();
    this.applicationCount = 0;
    this.lastHourReset = Date.now();
  }

  async initialize() {
    console.log("Initializing browser...");
    this.browser = await puppeteer.launch({
      headless: this.config.headless || false,
      slowMo: this.config.slowMo || 0,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    });

    this.page = await this.browser.newPage();

    // Set user agent
    await this.page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set viewport
    await this.page.setViewport({ width: 1280, height: 720 });

    console.log("Browser initialized successfully");
  }

  async login() {
    try {
      console.log("Navigating to login page...");
      await this.page.goto("https://www.codementor.io/login", {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      // Take a screenshot for debugging
      await this.page.screenshot({ path: "debug-login-page.png" });

      // Wait for and fill email field
      await this.page.waitForSelector(
        'input[name="email"], input[type="email"], #email',
        { timeout: 10000 }
      );
      await this.page.type(
        'input[name="email"], input[type="email"], #email',
        this.config.email
      );

      // Fill password field
      await this.page.waitForSelector(
        'input[name="password"], input[type="password"], #password',
        { timeout: 10000 }
      );
      await this.page.type(
        'input[name="password"], input[type="password"], #password',
        this.config.password
      );

      // Click login button
      const loginButton = await this.page.$(
        'button[type="submit"], .login-btn, [data-testid="login-submit"]'
      );
      if (loginButton) {
        await loginButton.click();
      } else {
        // Try pressing Enter on password field
        await this.page.keyboard.press("Enter");
      }

      // Wait for successful login
      await this.page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Take screenshot after login
      await this.page.screenshot({ path: "debug-after-login.png" });

      console.log("Successfully logged in to Codementor");
      console.log("Current URL:", this.page.url());
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      await this.page.screenshot({ path: "debug-login-failed.png" });
      throw error;
    }
  }

  async navigateToJobRequests() {
    try {
      console.log("Navigating to job requests page...");
      const jobRequestsUrl =
        "https://www.codementor.io/m/dashboard/open-requests?expertise=related";

      await this.page.goto(jobRequestsUrl, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      // Take screenshot for debugging
      await this.page.screenshot({ path: "debug-job-requests-page.png" });
      console.log("Current URL after navigation:", this.page.url());

      // Log page content for debugging
      const pageTitle = await this.page.title();
      console.log("Page title:", pageTitle);

      // Try to find any content on the page
      const bodyText = await this.page.evaluate(() => {
        return document.body.innerText.substring(0, 500);
      });
      console.log("Page content preview:", bodyText);

      // Try multiple possible selectors with more flexible approach
      const possibleSelectors = [
        '[data-testid="request-card"]',
        ".request-card",
        ".job-card",
        '[class*="request"]',
        '[class*="job"]',
        '[class*="card"]',
        ".card",
        '[data-cy="request-card"]',
        '[data-test="request-card"]',
      ];

      let foundSelector = null;

      for (const selector of possibleSelectors) {
        try {
          console.log(`Trying selector: ${selector}`);
          await this.page.waitForSelector(selector, { timeout: 3000 });
          foundSelector = selector;
          console.log(`✅ Found elements with selector: ${selector}`);
          break;
        } catch (e) {
          console.log(`❌ Selector ${selector} not found`);
          continue;
        }
      }

      if (!foundSelector) {
        // If no specific selectors work, try to find any clickable elements
        console.log("Trying to find any job-related elements...");

        const allElements = await this.page.evaluate(() => {
          const elements = document.querySelectorAll("*");
          const jobRelated = [];

          elements.forEach((el) => {
            const text = el.textContent?.toLowerCase() || "";
            const className = el.className?.toLowerCase() || "";

            if (
              text.includes("request") ||
              text.includes("job") ||
              className.includes("request") ||
              className.includes("job") ||
              className.includes("card")
            ) {
              jobRelated.push({
                tagName: el.tagName,
                className: el.className,
                id: el.id,
                text: text.substring(0, 100),
              });
            }
          });

          return jobRelated.slice(0, 10); // Limit to first 10 matches
        });

        console.log(
          "Found job-related elements:",
          JSON.stringify(allElements, null, 2)
        );

        // Check if we're on the right page or got redirected
        if (
          this.page.url().includes("login") ||
          this.page.url().includes("signin")
        ) {
          throw new Error(
            "Redirected to login page - authentication may have failed"
          );
        }

        throw new Error("No job request elements found on the page");
      }

      return foundSelector;
    } catch (error) {
      console.error("Failed to navigate to job requests:", error);
      await this.page.screenshot({ path: "debug-navigation-failed.png" });
      throw error;
    }
  }

  async getJobRequests() {
    try {
      const selector = await this.navigateToJobRequests();

      if (!selector) {
        console.log(
          "No valid selector found, attempting alternative approach..."
        );
        return this.getJobRequestsAlternative();
      }

      // Get all job request cards using the found selector
      const jobCards = await this.page.$$eval(selector, (cards) => {
        return cards.map((card, index) => {
          // Try multiple possible sub-selectors for different parts
          const titleSelectors = [
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            ".title",
            '[class*="title"]',
            '[data-testid*="title"]',
          ];
          const descriptionSelectors = [
            ".description",
            ".content",
            "p",
            '[class*="description"]',
            '[class*="content"]',
          ];
          const budgetSelectors = [
            ".budget",
            ".price",
            '[class*="budget"]',
            '[class*="price"]',
            '[data-testid*="budget"]',
          ];
          const linkSelectors = ["a", "[href]"];

          let title = "";
          let description = "";
          let budget = "";
          let url = "";

          // Find title
          for (const sel of titleSelectors) {
            const element = card.querySelector(sel);
            if (element && element.textContent.trim()) {
              title = element.textContent.trim();
              break;
            }
          }

          // Find description
          for (const sel of descriptionSelectors) {
            const element = card.querySelector(sel);
            if (
              element &&
              element.textContent.trim() &&
              element.textContent.trim() !== title
            ) {
              description = element.textContent.trim();
              break;
            }
          }

          // Find budget
          for (const sel of budgetSelectors) {
            const element = card.querySelector(sel);
            if (element && element.textContent.trim()) {
              budget = element.textContent.trim();
              break;
            }
          }

          // Find URL
          for (const sel of linkSelectors) {
            const element = card.querySelector(sel);
            if (element && element.href) {
              url = element.href;
              break;
            }
          }

          // If no title found, use card text content
          if (!title) {
            title =
              card.textContent.trim().substring(0, 100) ||
              `Job Request ${index + 1}`;
          }

          return {
            id:
              card.getAttribute("data-id") ||
              card.id ||
              `job-${index}-${Date.now()}`,
            title: title,
            description: description,
            budget: budget,
            url: url || window.location.href,
            skills: card.textContent || "",
            rawHTML: card.outerHTML.substring(0, 500), // For debugging
          };
        });
      });

      console.log(`Found ${jobCards.length} job requests`);

      // Log first job for debugging
      if (jobCards.length > 0) {
        console.log("First job sample:", JSON.stringify(jobCards[0], null, 2));
      }

      return jobCards;
    } catch (error) {
      console.error("Error fetching job requests:", error);
      return [];
    }
  }

  async getJobRequestsAlternative() {
    console.log("Using alternative method to find jobs...");

    try {
      // Wait a bit longer for dynamic content
      await this.page.waitForTimeout(5000);

      // Look for any clickable elements that might be jobs
      const jobs = await this.page.evaluate(() => {
        const potentialJobs = [];
        const elements = document.querySelectorAll("div, article, section");

        elements.forEach((el, index) => {
          const text = el.textContent || "";
          const hasJobKeywords =
            text.toLowerCase().includes("help") ||
            text.toLowerCase().includes("need") ||
            text.toLowerCase().includes("looking for") ||
            text.toLowerCase().includes("project") ||
            text.includes("$");

          if (hasJobKeywords && text.length > 50 && text.length < 1000) {
            potentialJobs.push({
              id: `alt-job-${index}`,
              title: text.substring(0, 100) + "...",
              description: text.substring(0, 300),
              budget: text.match(/\$\d+/)?.[0] || "Not specified",
              url: window.location.href,
              skills: text,
            });
          }
        });

        return potentialJobs.slice(0, 5); // Limit to 5 potential jobs
      });

      console.log(
        `Found ${jobs.length} potential jobs using alternative method`
      );
      return jobs;
    } catch (error) {
      console.error("Alternative job detection failed:", error);
      return [];
    }
  }

  // ... rest of your existing methods (shouldApplyToJob, applyToJob, etc.)

  shouldApplyToJob(job, criteria) {
    // Skip if already applied
    if (this.appliedJobs.has(job.id)) {
      return false;
    }

    // Check skills filter
    if (criteria.skillsFilter && criteria.skillsFilter.length > 0) {
      const jobText = (
        job.title +
        " " +
        job.description +
        " " +
        job.skills
      ).toLowerCase();
      const hasMatchingSkill = criteria.skillsFilter.some((skill) =>
        jobText.includes(skill.toLowerCase())
      );

      if (!hasMatchingSkill) {
        console.log(`Skipping job "${job.title}" - no matching skills`);
        return false;
      }
    }

    // Check budget filter
    if (criteria.minBudget) {
      const budgetMatch = job.budget.match(/\$(\d+)/);
      if (budgetMatch) {
        const budgetAmount = parseInt(budgetMatch[1]);
        if (budgetAmount < criteria.minBudget) {
          console.log(`Skipping job "${job.title}" - budget too low`);
          return false;
        }
      }
    }

    return true;
  }

  async monitorJobRequests(options = {}) {
    const {
      checkInterval = 30000,
      maxApplicationsPerHour = 10,
      skillsFilter = [],
      minBudget = 0,
    } = options;

    console.log("Starting job monitoring...");
    console.log(`Check interval: ${checkInterval / 1000}s`);
    console.log(`Max applications per hour: ${maxApplicationsPerHour}`);
    console.log(`Skills filter: ${skillsFilter.join(", ")}`);

    while (true) {
      try {
        // Reset application count every hour
        if (Date.now() - this.lastHourReset > 3600000) {
          this.applicationCount = 0;
          this.lastHourReset = Date.now();
          console.log("Application count reset for new hour");
        }

        // Check if we've reached the hourly limit
        if (this.applicationCount >= maxApplicationsPerHour) {
          console.log(
            `Reached hourly application limit (${maxApplicationsPerHour}). Waiting...`
          );
          await this.page.waitForTimeout(checkInterval);
          continue;
        }

        // Get current job requests
        const jobs = await this.getJobRequests();

        if (jobs.length === 0) {
          console.log("No jobs found, will retry in next cycle");
        } else {
          console.log(`Processing ${jobs.length} jobs...`);

          // Apply to matching jobs
          for (const job of jobs) {
            if (this.applicationCount >= maxApplicationsPerHour) {
              break;
            }

            if (this.shouldApplyToJob(job, { skillsFilter, minBudget })) {
              console.log(`Would apply to: ${job.title}`);
              // Uncomment when ready to actually apply
              // await this.applyToJob(job);
              // await this.page.waitForTimeout(3000);
            }
          }
        }

        console.log(
          `Applications sent this hour: ${this.applicationCount}/${maxApplicationsPerHour}`
        );

        // Wait before next check
        await this.page.waitForTimeout(checkInterval);
      } catch (error) {
        console.error("Error in monitoring loop:", error);
        await this.page.waitForTimeout(checkInterval);
      }
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      console.log("Browser closed");
    }
  }
}

module.exports = { CodementorJobBot };
