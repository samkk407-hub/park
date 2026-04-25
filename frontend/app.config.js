const fs = require("fs");
const path = require("path");

const appJson = require("./app.json");

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function normalizeDomain(domain) {
  if (!domain) return undefined;
  const withProtocol = domain.startsWith("http") ? domain : `http://${domain}`;
  return withProtocol.replace(/\/$/, "");
}

loadDotEnv();

module.exports = ({ config }) => ({
  ...config,
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    apiDomain: normalizeDomain(process.env.EXPO_PUBLIC_DOMAIN),
  },
});
