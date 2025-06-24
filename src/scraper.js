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
      slowMo: this.config.slowMo || 100,
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

    await this.page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
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

      await this.page.waitForSelector(
        'input[name="email"], input[type="email"], #email',
        { timeout: 10000 }
      );
      await this.page.type(
        'input[name="email"], input[type="email"], #email',
        this.config.email
      );

      await this.page.waitForSelector(
        'input[name="password"], input[type="password"], #password',
        { timeout: 10000 }
      );
      await this.page.type(
        'input[name="password"], input[type="password"], #password',
        this.config.password
      );

      const loginButton = await this.page.$(
        'button[type="submit"], .login-btn, [data-testid="login-submit"]'
      );
      if (loginButton) {
        await loginButton.click();
      } else {
        await this.page.keyboard.press("Enter");
      }

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

  async getJobRequests() {
    try {
      console.log("Navigating to job requests page...");
      await this.page.goto(
        "https://www.codementor.io/m/dashboard/open-requests?expertise=related",
        {
          waitUntil: "networkidle2",
          timeout: 60000,
        }
      );

      await this.page.waitForTimeout(3000);

      // Look for actual job request links on the listings page
      const jobLinks = await this.page.evaluate(() => {
        const links = [];

        // Find all links that contain job request paths
        const allLinks = document.querySelectorAll(
          'a[href*="/m/dashboard/open-requests/"]'
        );

        allLinks.forEach((link, index) => {
          const href = link.href;
          const title =
            link.textContent?.trim() ||
            link.querySelector(".req-title, h2, h3")?.textContent?.trim() ||
            `Job ${index + 1}`;

          // Only include individual job pages, not the main listings
          if (
            href.includes("/m/dashboard/open-requests/") &&
            href.split("/").pop() !== "open-requests"
          ) {
            links.push({
              url: href,
              title: title,
              id: href.split("/").pop() || `job-${index}`,
            });
          }
        });

        return links;
      });

      console.log(`Found ${jobLinks.length} job links`);

      if (jobLinks.length === 0) {
        // Fallback: look for any job-related elements
        const fallbackJobs = await this.page.evaluate(() => {
          const jobs = [];
          const elements = document.querySelectorAll(
            'h2, h3, .req-title, [class*="title"]'
          );

          elements.forEach((el, index) => {
            const text = el.textContent?.trim();
            if (
              text &&
              text.length > 20 &&
              (text.toLowerCase().includes("help") ||
                text.toLowerCase().includes("need") ||
                text.toLowerCase().includes("developer") ||
                text.includes("$"))
            ) {
              // Try to find a parent link
              let link = el.closest("a");
              if (!link) {
                link = el.parentElement?.querySelector("a");
              }

              jobs.push({
                url: link?.href || window.location.href + `#job-${index}`,
                title: text,
                id: `fallback-job-${index}`,
              });
            }
          });

          return jobs.slice(0, 5); // Limit to 5 jobs
        });

        console.log(`Found ${fallbackJobs.length} fallback jobs`);
        return fallbackJobs;
      }

      return jobLinks;
    } catch (error) {
      console.error("Error fetching job requests:", error);
      return [];
    }
  }

  shouldApplyToJob(job, criteria) {
    if (this.appliedJobs.has(job.id)) {
      return false;
    }

    if (criteria.skillsFilter && criteria.skillsFilter.length > 0) {
      const jobText = job.title.toLowerCase();

      const skillSynonyms = {
        javascript: ["js", "javascript", "node", "react", "vue", "angular"],
        "node.js": ["node", "nodejs", "node.js", "backend", "server"],
        react: ["react", "reactjs", "react.js", "frontend"],
        python: ["python", "py", "django", "flask", "fastapi"],
        ai: [
          "ai",
          "artificial intelligence",
          "machine learning",
          "ml",
          "deep learning",
          "chatbot",
          "nlp",
        ],
        mobile: [
          "mobile",
          "ios",
          "android",
          "react native",
          "flutter",
          "app development",
        ],
        html: ["html", "css", "email", "web", "frontend"],
        css: ["css", "styling", "sass", "scss"],
      };

      const hasMatchingSkill = criteria.skillsFilter.some((skill) => {
        const synonyms = skillSynonyms[skill.toLowerCase()] || [
          skill.toLowerCase(),
        ];
        return synonyms.some((synonym) => jobText.includes(synonym));
      });

      if (!hasMatchingSkill) {
        console.log(
          `⏭️  Skipping: "${job.title.substring(
            0,
            50
          )}..." - no matching skills`
        );
        return false;
      }
    }

    console.log(`✅ Job matches criteria: "${job.title.substring(0, 60)}..."`);
    return true;
  }

  // ...existing code...
  generateCoverLetter() {
    // Generate a short cover letter that's under 300 characters
    const shortLetters = [
      "Hi! I'm a skilled developer with expertise in JavaScript, Python, React, and Node.js. I deliver quality solutions with clear communication. I'd love to help with your project and discuss how I can bring value to your team.",

      "Hello! Experienced full-stack developer here. I specialize in JavaScript, Python, mobile apps, and AI/ML. I'm committed to delivering excellent results and maintaining great communication throughout the project.",

      "Hi there! I'm a versatile developer with strong skills in web development, mobile apps, and AI solutions. I focus on quality code and clear communication. I'm excited to contribute to your project's success.",

      "Hello! Professional developer with expertise in React, Node.js, Python, and mobile development. I deliver high-quality solutions on time with excellent communication. Ready to help bring your vision to life!",
    ];

    // Randomly select one to avoid repetition
    const selected =
      shortLetters[Math.floor(Math.random() * shortLetters.length)];

    // Ensure it's under 300 characters
    if (selected.length > 300) {
      return selected.substring(0, 297) + "...";
    }

    console.log(`📝 Generated cover letter (${selected.length} characters)`);
    return selected;
  }

  async applyToJob(job) {
    try {
      console.log(`🎯 APPLYING TO: ${job.title.substring(0, 80)}...`);

      // Navigate to the specific job page
      await this.page.goto(job.url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await this.page.waitForTimeout(2000);

      // Wait for the application form to load
      await this.page.waitForSelector("form, textarea, .MuiTextField-root", {
        timeout: 10000,
      });

      // Generate a short cover letter
      const coverLetter = this.generateCoverLetter();
      console.log(
        `📝 Using cover letter: "${coverLetter.substring(0, 50)}..." (${
          coverLetter.length
        } chars)`
      );

      // Find and type into the textarea (like email/password)
      const textareaFilled = await this.page.evaluate(() => {
        // Look for the textarea in the application form
        const textareas = document.querySelectorAll("textarea");

        for (let textarea of textareas) {
          const isApplicationTextarea =
            textarea.placeholder?.toLowerCase().includes("required") ||
            textarea.closest(".MuiTextField-root") ||
            textarea.name?.toLowerCase().includes("message") ||
            textarea.id?.toLowerCase().includes("message") ||
            textarea.className?.toLowerCase().includes("message") ||
            textarea.getAttribute("data-testid")?.includes("message") ||
            textarea.closest("form");

          if (isApplicationTextarea) {
            // Focus the textarea first
            textarea.focus();
            textarea.click();

            // Clear any existing content
            textarea.value = "";
            textarea.dispatchEvent(new Event("input", { bubbles: true }));

            console.log("Found and focused textarea for typing");
            return true;
          }
        }

        // Fallback: try the first textarea
        if (textareas.length > 0) {
          const firstTextarea = textareas[0];
          firstTextarea.focus();
          firstTextarea.click();
          firstTextarea.value = "";
          firstTextarea.dispatchEvent(new Event("input", { bubbles: true }));
          console.log("Using first available textarea as fallback");
          return true;
        }

        return false;
      });

      if (!textareaFilled) {
        console.log("❌ Could not find textarea to focus");
        return false;
      }

      // Now type the cover letter character by character (like email/password)
      console.log("⌨️  Typing cover letter character by character...");

      // Wait a moment for focus to be established
      await this.page.waitForTimeout(1000);

      // Type the cover letter using the same method as email/password
      await this.page.keyboard.type(coverLetter, { delay: 50 }); // 50ms delay between characters

      // Wait for typing to complete
      await this.page.waitForTimeout(1000);

      // Verify the text was actually entered
      const textVerified = await this.page.evaluate((expectedLength) => {
        const textareas = document.querySelectorAll("textarea");
        for (let textarea of textareas) {
          if (textarea.value && textarea.value.length >= expectedLength - 10) {
            // Allow small variance
            console.log(
              `✅ Verified textarea has ${textarea.value.length} characters (expected ~${expectedLength})`
            );
            return textarea.value.length;
          }
        }
        console.log("❌ No textarea found with expected content length");
        return 0;
      }, coverLetter.length);

      if (textVerified === 0) {
        console.log(
          "❌ Text verification failed - textarea appears empty after typing"
        );

        // Debug: show what's in textareas
        await this.page.evaluate(() => {
          const textareas = document.querySelectorAll("textarea");
          textareas.forEach((ta, i) => {
            console.log(
              `Textarea ${i}: "${ta.value}" (${ta.value.length} chars)`
            );
          });
        });

        return false;
      }

      console.log(
        `✅ Successfully typed ${textVerified} characters into textarea`
      );

      // Wait a moment for form validation to process
      await this.page.waitForTimeout(2000);

      // Find and click the submit button
      const submitClicked = await this.page.evaluate(() => {
        // Look for submit buttons with various selectors
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button[class*="submit"]',
          ".MuiButton-root",
          "button",
        ];

        for (let selector of submitSelectors) {
          const buttons = document.querySelectorAll(selector);

          for (let button of buttons) {
            const buttonText = button.textContent?.toLowerCase() || "";
            const isSubmitButton =
              button.type === "submit" ||
              buttonText.includes("submit") ||
              buttonText.includes("apply") ||
              buttonText.includes("send") ||
              button.className.toLowerCase().includes("submit");

            if (
              isSubmitButton &&
              !button.disabled &&
              button.offsetParent !== null
            ) {
              console.log(`Found submit button: "${buttonText}" (${selector})`);
              button.click();
              return true;
            }
          }
        }

        return false;
      });

      if (submitClicked) {
        await this.page.waitForTimeout(4000); // Wait for submission to process

        // Check for success indicators or if we're still on the same page
        const submissionResult = await this.page.evaluate(() => {
          // Look for success messages
          const successIndicators = [
            "success",
            "submitted",
            "applied",
            "thank you",
            "confirmation",
          ];

          const pageText = document.body.textContent?.toLowerCase() || "";
          const hasSuccessMessage = successIndicators.some((indicator) =>
            pageText.includes(indicator)
          );

          // Also check if we're no longer on a job application page
          const currentUrl = window.location.href;
          const isStillOnJobPage = currentUrl.includes("/open-requests/");

          return {
            hasSuccessMessage,
            isStillOnJobPage,
            currentUrl,
          };
        });

        this.appliedJobs.add(job.id);
        this.applicationCount++;

        console.log(
          `✅ SUCCESSFULLY APPLIED to: ${job.title.substring(0, 60)}...`
        );
        console.log(
          `📊 Total applications this hour: ${this.applicationCount}`
        );
        console.log(
          `🔗 Result: Success message: ${submissionResult.hasSuccessMessage}, Still on job page: ${submissionResult.isStillOnJobPage}`
        );

        return true;
      } else {
        console.log(
          `❌ Could not find submit button for: ${job.title.substring(
            0,
            60
          )}...`
        );

        // Debug: log available buttons and their states
        await this.page.evaluate(() => {
          const buttons = document.querySelectorAll(
            "button, input[type='submit']"
          );
          console.log(`Found ${buttons.length} buttons/inputs on page:`);
          buttons.forEach((btn, i) => {
            console.log(
              `Button ${i}: "${btn.textContent?.trim()}" (type: ${
                btn.type
              }, disabled: ${btn.disabled}, visible: ${
                btn.offsetParent !== null
              })`
            );
          });

          // Also check for any validation errors
          const errorElements = document.querySelectorAll(
            '.error, .MuiFormHelperText-root, [class*="error"]'
          );
          if (errorElements.length > 0) {
            console.log("Found potential validation errors:");
            errorElements.forEach((el, i) => {
              console.log(`Error ${i}: "${el.textContent?.trim()}"`);
            });
          }
        });

        return false;
      }
    } catch (error) {
      console.error(
        `❌ Error applying to job "${job.title.substring(0, 60)}...":`,
        error.message
      );
      return false;
    }
  }

  async monitorJobRequests(options = {}) {
    const {
      checkInterval = 30000, // Reduced to 30 seconds for faster scanning
      maxApplicationsPerHour = 50, // Increased from 10 to 50
      skillsFilter = [],
      minBudget = 0,
    } = options;

    console.log("🚀 Starting job monitoring...");
    console.log(`⏱️  Check interval: ${checkInterval / 1000}s`);
    console.log(`📊 Max applications per hour: ${maxApplicationsPerHour}`);
    console.log(`🎯 Skills filter: ${skillsFilter.join(", ")}`);

    while (true) {
      try {
        // Reset application count every hour
        if (Date.now() - this.lastHourReset > 3600000) {
          this.applicationCount = 0;
          this.lastHourReset = Date.now();
          console.log("🔄 Application count reset for new hour");
        }

        if (this.applicationCount >= maxApplicationsPerHour) {
          console.log(
            `⏸️  Reached hourly application limit (${maxApplicationsPerHour}). Waiting...`
          );
          await this.page.waitForTimeout(checkInterval);
          continue;
        }

        console.log("🔍 Scanning for job opportunities...");
        const jobs = await this.getJobRequests();

        if (jobs.length === 0) {
          console.log("😴 No jobs found, will retry in next cycle");
        } else {
          console.log(`📋 Processing ${jobs.length} jobs...`);

          for (const job of jobs) {
            if (this.applicationCount >= maxApplicationsPerHour) {
              console.log(
                "⏸️  Hourly limit reached, stopping applications for this cycle"
              );
              break;
            }

            if (this.shouldApplyToJob(job, { skillsFilter, minBudget })) {
              const success = await this.applyToJob(job);
              if (success) {
                // Reduced wait time between applications for higher throughput
                await this.page.waitForTimeout(3000); // Reduced from 8000 to 3000ms
              }
            }
          }
        }

        console.log(
          `📈 Applications sent this hour: ${this.applicationCount}/${maxApplicationsPerHour}`
        );
        console.log(
          `⏳ Waiting ${checkInterval / 1000}s before next scan...\n`
        );

        await this.page.waitForTimeout(checkInterval);
      } catch (error) {
        console.error("💥 Error in monitoring loop:", error);
        await this.page.waitForTimeout(checkInterval);
      }
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      console.log("🔒 Browser closed");
    }
  }
}

module.exports = { CodementorJobBot };
