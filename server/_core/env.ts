import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Read API key from ~/.genspark_llm.yaml as fallback
function loadGenSparkConfig(): { apiKey: string; baseUrl: string } {
  try {
    const configPath = path.join(os.homedir(), ".genspark_llm.yaml");
    if (!fs.existsSync(configPath)) return { apiKey: "", baseUrl: "" };
    const content = fs.readFileSync(configPath, "utf8");
    // Simple YAML parsing without external dependency
    let apiKey = "";
    let baseUrl = "";
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("api_key:")) {
        apiKey = trimmed.replace("api_key:", "").trim().replace(/^['"]|['"]$/g, "");
        // Resolve ${GENSPARK_TOKEN} or similar env var references
        const envMatch = apiKey.match(/^\$\{(\w+)\}$/);
        if (envMatch) {
          apiKey = process.env[envMatch[1]] ?? "";
        }
      }
      if (trimmed.startsWith("base_url:")) {
        baseUrl = trimmed.replace("base_url:", "").trim().replace(/^['"]|['"]$/g, "");
      }
    }
    return { apiKey, baseUrl };
  } catch {
    return { apiKey: "", baseUrl: "" };
  }
}

const gensparkConfig = loadGenSparkConfig();

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL || process.env.OPENAI_BASE_URL || gensparkConfig.baseUrl || "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY || gensparkConfig.apiKey || "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? "",
  // Cloudflare R2 Storage
  r2AccountId: process.env.R2_ACCOUNT_ID ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2BucketName: process.env.R2_BUCKET_NAME ?? "taekwondo-receipts",
  r2PublicDomain: process.env.R2_PUBLIC_DOMAIN ?? "", // Optional: custom domain for public access
};
