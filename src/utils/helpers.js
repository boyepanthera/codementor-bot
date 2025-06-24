const fs = require("fs").promises;
const path = require("path");

class JobLogger {
  constructor(logDir = "logs") {
    this.logDir = logDir;
    this.ensureLogDir();
  }

  async ensureLogDir() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error("Error creating log directory:", error);
    }
  }

  async logApplication(job, success, error = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      job: {
        id: job.id,
        title: job.title,
        budget: job.budget,
        url: job.url,
      },
      success,
      error: error?.message || null,
    };

    const logFile = path.join(
      this.logDir,
      `applications-${new Date().toISOString().split("T")[0]}.json`
    );

    try {
      let logs = [];
      try {
        const existingLogs = await fs.readFile(logFile, "utf8");
        logs = JSON.parse(existingLogs);
      } catch (e) {
        // File doesn't exist yet
      }

      logs.push(logEntry);
      await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error("Error writing to log file:", error);
    }
  }
}

// Keep your existing utility functions and add new ones
export const formatData = (data) => {
  // Format the data as needed
  return data.map((item) => ({
    title: item.title.trim(),
    link: item.link.trim(),
    description: item.description.trim(),
  }));
};

export const logError = (error) => {
  console.error("Error:", error);
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractBudgetAmount(budgetText) {
  const match = budgetText.match(/\$(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

module.exports = {
  JobLogger,
  delay,
  extractBudgetAmount,
  formatData,
  logError,
};
