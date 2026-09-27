# Google Feedback Setup

The Apps Script connects to your existing Google Form. The PlanetMusic contact form submits to the script, which records the response in that Form and emails the Google account that authorized setup.

## Install the Apps Script

1. Ensure your Form has exactly these questions: **Name** (Short answer), **Subject** (Short answer), and **Message** (Paragraph). The titles and types must match.
2. Sign in to the Google account that should receive feedback notifications and open [script.google.com](https://script.google.com).
3. Create a **New project** and replace the contents of `Code.gs` with the contents of this folder's `Code.gs`.
4. Select `setupFeedbackIntegration` in the function picker and click **Run**. Review and approve Google's authorization prompts. The script opens the Form ID already configured in `Code.gs`, checks the questions, and installs the notification trigger.
5. Open the run's **Execution log** and confirm the notification email is the account you expect.
6. In Apps Script, click **Deploy > New deployment**, choose **Web app**, set **Execute as** to your account, and set access to **Anyone**. Click **Deploy**, approve any prompt, and copy the Web app URL ending in `/exec`.

## Connect PlanetMusic

Add the deployment URL to the project's ignored `.env.local` file:

```dotenv
VITE_GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Restart the Vite server. For a production deployment, add the same `VITE_GOOGLE_APPS_SCRIPT_URL` variable to the hosting provider's environment settings and rebuild/redeploy the site.

## Verify

Submit a message from PlanetMusic's Contact page. It should appear in the generated Google Form's Responses tab and an email should arrive at the account that ran `setupFeedbackIntegration`.

The web app must be publicly reachable for visitors to submit. The Form must accept responses from anyone with its responder link. The script includes field length checks and a honeypot, but the public endpoint can still receive spam; add a CAPTCHA if that becomes a problem. Google may also require a Workspace administrator to allow public Apps Script web apps.