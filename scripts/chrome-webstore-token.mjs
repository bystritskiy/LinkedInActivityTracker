// Mints a fresh Chrome Web Store refresh token via a local OAuth flow.
// Usage: CHROME_WEBSTORE_CLIENT_ID=... CHROME_WEBSTORE_CLIENT_SECRET=... node scripts/chrome-webstore-token.mjs
import http from "node:http";
import { exec } from "node:child_process";

const clientId = process.env.CHROME_WEBSTORE_CLIENT_ID;
const clientSecret = process.env.CHROME_WEBSTORE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Set CHROME_WEBSTORE_CLIENT_ID and CHROME_WEBSTORE_CLIENT_SECRET env vars.");
  process.exit(1);
}

const port = 8123;
const redirectUri = `http://localhost:${port}`;

const authUrl = new URL("https://accounts.google.com/o/oauth2/auth");
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/chromewebstore",
  access_type: "offline",
  prompt: "consent",
}).toString();

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, redirectUri).searchParams.get("code");
  if (!code) {
    res.writeHead(404).end();
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h1>Done — return to the terminal.</h1>");
  server.close();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const token = await response.json();
  if (!token.refresh_token) {
    console.error(`Token exchange failed: ${JSON.stringify(token)}`);
    process.exit(1);
  }

  console.log("\nNew refresh token:\n");
  console.log(token.refresh_token);
  console.log("\nUpdate the GitHub secret with:");
  console.log("  gh secret set CHROME_WEBSTORE_REFRESH_TOKEN");
});

server.listen(port, () => {
  console.log("Opening browser for Google sign-in…");
  console.log(`If it does not open, visit:\n${authUrl}`);
  exec(`open "${authUrl}"`);
});
