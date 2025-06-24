# Codementor Job Application Bot

An automated web scraping application using Puppeteer to monitor and apply to job requests on Codementor.io. This bot helps streamline the job application process by automatically detecting new job postings that match your skills and criteria.

## Features

- 🤖 **Automated Login**: Securely logs into your Codementor account
- 🔍 **Smart Job Detection**: Uses multiple selector strategies to find job postings
- 🎯 **Skill-based Filtering**: Only applies to jobs matching your specified skills
- 💰 **Budget Filtering**: Filter jobs by minimum budget requirements
- ⏱️ **Rate Limiting**: Respects platform limits with configurable application rates
- 📸 **Debug Screenshots**: Captures screenshots for troubleshooting
- 📝 **Application Logging**: Tracks all applications with detailed logs
- 🔄 **Continuous Monitoring**: Monitors for new jobs at configurable intervals

## Prerequisites

- Node.js (v14 or higher)
- A Codementor.io account
- Chrome/Chromium browser (automatically handled by Puppeteer)

## Installation

1. Clone or download the project:

```bash
git clone <repository-url>
cd codementor-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp .env.example .env
```

4. Configure your credentials in `.env`:

```env
CODEMENTOR_EMAIL=your_email@example.com
CODEMENTOR_PASSWORD=your_password
```

## Configuration

### Environment Variables

| Variable              | Description                 | Required |
| --------------------- | --------------------------- | -------- |
| `CODEMENTOR_EMAIL`    | Your Codementor login email | Yes      |
| `CODEMENTOR_PASSWORD` | Your Codementor password    | Yes      |

### Bot Configuration

The bot can be configured in `src/index.js`:

```javascript
// Bot initialization options
const bot = new CodementorJobBot({
  email: process.env.CODEMENTOR_EMAIL,
  password: process.env.CODEMENTOR_PASSWORD,
  headless: false, // Set to true for production
  slowMo: 100, // Slow down actions (ms)
});

// Monitoring options
await bot.monitorJobRequests({
  checkInterval: 30000, // Check every 30 seconds
  maxApplicationsPerHour: 10, // Rate limiting
  skillsFilter: ["javascript", "node.js", "react", "python", "ai"],
  minBudget: 50, // Minimum budget in USD
});
```

## Usage

### Development Mode (with visual browser)

```bash
npm run dev
```

### Production Mode (headless)

```bash
npm start
```

### Debug Mode (with Node.js inspector)

```bash
npm run debug
```

## How It Works

1. **Authentication**: The bot logs into your Codementor account using provided credentials
2. **Navigation**: Navigates to the job requests dashboard (`/m/dashboard/open-requests?expertise=related`)
3. **Job Detection**: Uses multiple strategies to detect job postings:
   - Primary: Looks for specific CSS selectors
   - Fallback: Content-based detection using keywords
4. **Filtering**: Applies your specified filters (skills, budget, etc.)
5. **Application**: Submits applications with auto-generated cover letters
6. **Monitoring**: Continuously monitors for new jobs at set intervals

## Project Structure

```
codementor-bot/
├── src/
│   ├── index.js          # Main entry point
│   ├── scraper.js        # Core bot logic and Puppeteer automation
│   └── utils/
│       └── helpers.js    # Utility functions and logging
├── logs/                 # Application logs (auto-generated)
├── debug-*.png          # Debug screenshots (auto-generated)
├── package.json         # Dependencies and scripts
├── .env                 # Environment variables
└── README.md           # This file
```

## Customization

### Skills Filter

Update the `skillsFilter` array to match your expertise:

```javascript
skillsFilter: [
  "javascript",
  "typescript",
  "react",
  "vue",
  "angular",
  "node.js",
  "express",
  "python",
  "django",
  "flask",
  "ai",
  "machine learning",
  "data science",
];
```

### Cover Letter Template

Modify the `generateCoverLetter()` method in `scraper.js`:

```javascript
generateCoverLetter() {
    return `Hello,

I'm excited to apply for this opportunity. As a skilled developer with expertise in modern web technologies, I believe I can deliver excellent results for your project.

My experience includes:
- Full-stack JavaScript development (Node.js, React, Express)
- Python development and AI/ML implementations
- Database design and optimization
- API development and integration

I'm committed to delivering high-quality code and maintaining clear communication throughout the project.

Best regards,
[Your Name]`;
}
```

### Rate Limiting

Adjust application frequency to respect platform guidelines:

```javascript
{
    checkInterval: 60000,        // Check every minute
    maxApplicationsPerHour: 5,   // Conservative rate
    minBudget: 100              // Higher budget threshold
}
```

## Debugging

The bot includes comprehensive debugging features:

1. **Screenshots**: Automatically captures screenshots at key steps
2. **Console Logging**: Detailed logs of all operations
3. **Element Detection**: Reports which selectors work/fail
4. **Page Content**: Shows actual page content for troubleshooting

Debug files are saved in the project root:

- `debug-login-page.png`
- `debug-after-login.png`
- `debug-job-requests-page.png`
- `debug-navigation-failed.png`

## Logs

Application logs are automatically saved in the `logs/` directory:

- Daily log files: `applications-YYYY-MM-DD.json`
- Each entry includes timestamp, job details, and success/failure status

## Safety Features

- **Rate Limiting**: Prevents overwhelming the platform
- **Error Handling**: Graceful handling of network issues and page changes
- **Authentication Checks**: Verifies successful login before proceeding
- **Duplicate Prevention**: Tracks applied jobs to avoid reapplication

## Troubleshooting

### Common Issues

1. **Login Failed**

   - Verify credentials in `.env` file
   - Check if 2FA is enabled (may need manual intervention)
   - Review `debug-login-failed.png` screenshot

2. **No Jobs Found**

   - Check if you're logged into the correct account
   - Verify the job requests URL is accessible
   - Review `debug-job-requests-page.png` for page content

3. **Selector Not Found**
   - Codementor may have updated their UI
   - Check console logs for attempted selectors
   - The bot will fallback to alternative detection methods

### Getting Help

1. Check the debug screenshots in your project directory
2. Review console logs for detailed error messages
3. Ensure your Codementor profile is complete and active
4. Verify you have access to the job requests dashboard

## Legal and Ethical Considerations

- ⚖️ **Terms of Service**: Ensure compliance with Codementor's ToS
- 🤝 **Respectful Usage**: Use reasonable rate limits
- 📧 **Quality Applications**: Customize cover letters for relevance
- 🔒 **Account Security**: Keep credentials secure and use environment variables

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License - see the package.json file for details.

## Disclaimer

This tool is for educational and personal use. Users are responsible for:

- Complying with Codementor.io's terms of service
- Using the bot responsibly and ethically
- Ensuring applications are relevant and high-quality
- Maintaining account security

The authors are not responsible for any account restrictions or violations that may result from using this tool.
