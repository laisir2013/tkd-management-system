// Load .env file to get user-configured API keys
const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  try {
    const envPath = path.join('/home/user/webapp', '.env');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const vars = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      vars[key] = value;
    }
    return vars;
  } catch (e) {
    return {};
  }
}

const dotenv = loadDotEnv();

module.exports = {
  apps: [
    {
      name: 'taekwondo',
      script: 'node',
      args: 'dist/index.js',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: dotenv.DATABASE_URL || 'mysql://tkd_user:tkd_pass_2026@localhost:3306/taekwondo',
        JWT_SECRET: dotenv.JWT_SECRET || 'taekwondo-local-dev-secret-key-2026',
        VITE_APP_ID: dotenv.VITE_APP_ID || 'local-dev',
        OWNER_OPEN_ID: dotenv.OWNER_OPEN_ID || 'admin-local',
        OAUTH_SERVER_URL: dotenv.OAUTH_SERVER_URL || '',
        // LLM API - 優先使用 .env 裡的設定
        OPENAI_API_KEY: dotenv.OPENAI_API_KEY || '',
        OPENAI_BASE_URL: dotenv.OPENAI_BASE_URL || '',
        // R2 Storage
        R2_ACCOUNT_ID: dotenv.R2_ACCOUNT_ID || '',
        R2_ACCESS_KEY_ID: dotenv.R2_ACCESS_KEY_ID || '',
        R2_SECRET_ACCESS_KEY: dotenv.R2_SECRET_ACCESS_KEY || '',
        R2_BUCKET_NAME: dotenv.R2_BUCKET_NAME || 'taekwondo-receipts',
        R2_PUBLIC_DOMAIN: dotenv.R2_PUBLIC_DOMAIN || '',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    }
  ]
}
