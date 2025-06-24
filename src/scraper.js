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

      // Wait for and fill email field
      await this.page.waitForSelector('input[name="email"]', {
        timeout: 10000,
      });
      await this.page.type('input[name="email"]', this.config.email);

      // Fill password field
      await this.page.waitForSelector('input[name="password"]', {
        timeout: 10000,
      });
      await this.page.type('input[name="password"]', this.config.password);

      // Click login button
      await this.page.click('button[type="submit"]');

      // Wait for successful login (check for dashboard or profile redirect)
      await this.page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      console.log("Successfully logged in to Codementor");
      return true;
    } catch (error) {
      console.error("Login failed:", error);
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

      // Wait for job listings to load
      await this.page.waitForSelector(
        '[data-testid="request-card"], .request-card, .job-card',
        {
          timeout: 15000,
        }
      );

      console.log("Successfully navigated to job requests page");
      return true;
    } catch (error) {
      console.error("Failed to navigate to job requests:", error);
      throw error;
    }
  }

  async getJobRequests() {
    try {
      await this.navigateToJobRequests();

      // Get all job request cards
      const jobCards = await this.page.$$eval(
        '[data-testid="request-card"], .request-card, .job-card',
        (cards) => {
          return cards.map((card) => {
            const titleElement = card.querySelector(
              'h3, h4, .title, [data-testid="request-title"]'
            );
            const descriptionElement = card.querySelector(
              ".description, .content, p"
            );
            const budgetElement = card.querySelector(
              '.budget, .price, [data-testid="budget"]'
            );
            const linkElement = card.querySelector("a");
            const skillsElement = card.querySelector(
              ".skills, .tags, .tech-stack"
            );

            return {
              id:
                card.getAttribute("data-id") ||
                card.id ||
                Math.random().toString(36),
              title: titleElement?.textContent?.trim() || "",
              description: descriptionElement?.textContent?.trim() || "",
              budget: budgetElement?.textContent?.trim() || "",
              url: linkElement?.href || "",
              skills: skillsElement?.textContent?.trim() || "",
              element: card,
            };
          });
        }
      );

      console.log(`Found ${jobCards.length} job requests`);
      return jobCards;
    } catch (error) {
      console.error("Error fetching job requests:", error);
      return [];
    }
  }

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

  async applyToJob(job) {
    try {
      console.log(`Applying to job: ${job.title}`);

      // Click on the job to open details or application modal
      if (job.url) {
        await this.page.goto(job.url, { waitUntil: "networkidle2" });
      }

      // Look for apply button
      const applyButtonSelectors = [
        'button[data-testid="apply-button"]',
        'button:contains("Apply")',
        ".apply-btn",
        '[data-action="apply"]',
        'button[type="submit"]',
      ];

      let applyButton = null;
      for (const selector of applyButtonSelectors) {
        try {
          applyButton = await this.page.$(selector);
          if (applyButton) break;
        } catch (e) {
          continue;
        }
      }

      if (!applyButton) {
        console.log("Apply button not found, trying alternative approach...");
        // Try clicking on the job card itself
        await this.page.evaluate((jobId) => {
          const card = document.querySelector(`[data-id="${jobId}"]`);
          if (card) card.click();
        }, job.id);

        await this.page.waitForTimeout(2000);

        // Try finding apply button again
        for (const selector of applyButtonSelectors) {
          try {
            applyButton = await this.page.$(selector);
            if (applyButton) break;
          } catch (e) {
            continue;
          }
        }
      }

      if (applyButton) {
        await applyButton.click();
        await this.page.waitForTimeout(1000);

        // Fill cover letter if modal appears
        await this.fillCoverLetter();

        // Submit application
        const submitButton = await this.page.$(
          'button[type="submit"], .submit-btn, [data-testid="submit"]'
        );
        if (submitButton) {
          await submitButton.click();
          await this.page.waitForTimeout(2000);
        }

        this.appliedJobs.add(job.id);
        this.applicationCount++;
        console.log(`✅ Successfully applied to: ${job.title}`);
        return true;
      } else {
        console.log(`❌ Could not find apply button for: ${job.title}`);
        return false;
      }
    } catch (error) {
      console.error(`Error applying to job "${job.title}":`, error);
      return false;
    }
  }

  async fillCoverLetter() {
    try {
      const coverLetterSelectors = [
        'textarea[name="cover_letter"]',
        'textarea[data-testid="cover-letter"]',
        ".cover-letter textarea",
        'textarea[placeholder*="cover"]',
      ];

      for (const selector of coverLetterSelectors) {
        const textarea = await this.page.$(selector);
        if (textarea) {
          const coverLetter = this.generateCoverLetter();
          await textarea.click();
          await textarea.type(coverLetter);
          break;
        }
      }
    } catch (error) {
      console.error("Error filling cover letter:", error);
    }
  }

  generateCoverLetter() {
    return `Hello,

I'm excited to apply for this opportunity. As a skilled developer with expertise in modern web technologies, I believe I can deliver excellent results for your project.

My experience includes:
- Full-stack JavaScript development (Node.js, React, Express)
- Python development and AI/ML implementations
- Database design and optimization
- API development and integration

I'm committed to delivering high-quality code and maintaining clear communication throughout the project. I'd love to discuss how I can help bring your vision to life.

Best regards,
Boye`;
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

        // Apply to matching jobs
        for (const job of jobs) {
          if (this.applicationCount >= maxApplicationsPerHour) {
            break;
          }

          if (this.shouldApplyToJob(job, { skillsFilter, minBudget })) {
            await this.applyToJob(job);
            await this.page.waitForTimeout(3000); // Rate limiting
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
