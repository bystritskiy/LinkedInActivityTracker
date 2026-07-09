#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const requiredEnv = [
  "CHROME_WEBSTORE_CLIENT_ID",
  "CHROME_WEBSTORE_CLIENT_SECRET",
  "CHROME_WEBSTORE_REFRESH_TOKEN",
  "CHROME_WEBSTORE_PUBLISHER_ID",
  "CHROME_WEBSTORE_EXTENSION_ID",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const zipPath = process.argv[2] || process.env.CHROME_WEBSTORE_ZIP_PATH;
if (!zipPath) {
  throw new Error("Usage: node scripts/chrome-webstore-publish.mjs <extension.zip>");
}

const resolvedZipPath = path.resolve(zipPath);
const zipStats = await stat(resolvedZipPath);
if (!zipStats.isFile()) {
  throw new Error(`Extension package is not a file: ${resolvedZipPath}`);
}

const {
  CHROME_WEBSTORE_CLIENT_ID: clientId,
  CHROME_WEBSTORE_CLIENT_SECRET: clientSecret,
  CHROME_WEBSTORE_REFRESH_TOKEN: refreshToken,
  CHROME_WEBSTORE_PUBLISHER_ID: publisherId,
  CHROME_WEBSTORE_EXTENSION_ID: extensionId,
} = process.env;

const blockOnWarnings = process.env.CHROME_WEBSTORE_BLOCK_ON_WARNINGS !== "false";
const itemName = `publishers/${publisherId}/items/${extensionId}`;
const apiBase = "https://chromewebstore.googleapis.com/v2";
const uploadBase = "https://chromewebstore.googleapis.com/upload/v2";

async function requestJson(label, url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function refreshAccessToken() {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const token = await requestJson("OAuth token refresh", "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!token.access_token) {
    throw new Error(`OAuth token refresh did not return an access token: ${JSON.stringify(token)}`);
  }

  return token.access_token;
}

async function fetchStatus(accessToken) {
  return requestJson("Fetch status", `${apiBase}/${itemName}:fetchStatus`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function waitForUpload(accessToken, initialUploadState) {
  const terminalSuccessStates = new Set(["SUCCEEDED", "SUCCESS", "UPLOAD_SUCCESS"]);
  const terminalFailureStates = new Set(["FAILED", "FAILURE", "UPLOAD_FAILURE"]);
  let state = initialUploadState;

  if (terminalSuccessStates.has(state)) {
    return;
  }

  for (let attempt = 1; attempt <= 24; attempt += 1) {
    if (terminalFailureStates.has(state)) {
      throw new Error(`Chrome Web Store upload failed with state: ${state}`);
    }

    if (state && state !== "IN_PROGRESS" && state !== "UPLOAD_IN_PROGRESS") {
      throw new Error(`Chrome Web Store upload returned unexpected state: ${state}`);
    }

    console.log(`[cws] upload still processing; polling status (${attempt}/24)`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const status = await fetchStatus(accessToken);
    state = status.lastAsyncUploadState;

    if (terminalSuccessStates.has(state)) {
      return;
    }
  }

  throw new Error("Chrome Web Store upload did not finish within 120 seconds");
}

const accessToken = await refreshAccessToken();
console.log(`[cws] uploading ${resolvedZipPath} (${zipStats.size} bytes)`);

const zipBuffer = await readFile(resolvedZipPath);
const upload = await requestJson("Upload", `${uploadBase}/${itemName}:upload`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/zip",
  },
  body: zipBuffer,
});

console.log(
  `[cws] uploaded item=${upload.itemId ?? extensionId} version=${upload.crxVersion ?? "pending"} state=${upload.uploadState}`,
);

await waitForUpload(accessToken, upload.uploadState);

const publish = await requestJson("Publish", `${apiBase}/${itemName}:publish`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    publishType: "DEFAULT_PUBLISH",
    blockOnWarnings,
  }),
});

console.log(`[cws] publish submitted item=${publish.itemId ?? extensionId} state=${publish.state ?? "unknown"}`);

const warnings = publish.warningInfo?.warnings ?? [];
if (warnings.length > 0) {
  console.log(`[cws] publish warnings: ${JSON.stringify(warnings)}`);
}

