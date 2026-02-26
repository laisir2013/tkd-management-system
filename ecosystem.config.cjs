// Read GenSpark LLM config from ~/.genspark_llm.yaml
const fs = require('fs');
const path = require('path');
const os = require('os');

function loadGenSparkConfig() {
  try {
    const configPath = path.join(os.homedir(), '.genspark_llm.yaml');
    if (!fs.existsSync(configPath)) return { apiKey: '', baseUrl: '' };
    const content = fs.readFileSync(configPath, 'utf8');
    let apiKey = '';
    let baseUrl = '';
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('api_key:')) {
        apiKey = trimmed.replace('api_key:', '').trim().replace(/^['"]|['"]$/g, '');
        const envMatch = apiKey.match(/^\$\{(\w+)\}$/);
        if (envMatch) {
          apiKey = process.env[envMatch[1]] || '';
        }
      }
      if (trimmed.startsWith('base_url:')) {
        baseUrl = trimmed.replace('base_url:', '').trim().replace(/^['"]|['"]$/g, '');
      }
    }
    return { apiKey, baseUrl };
  } catch (e) {
    return { apiKey: '', baseUrl: '' };
  }
}

const genspark = loadGenSparkConfig();

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
        DATABASE_URL: 'mysql://tkd_user:tkd_pass_2026@localhost:3306/taekwondo',
        JWT_SECRET: 'taekwondo-local-dev-secret-key-2026',
        VITE_APP_ID: 'local-dev',
        OWNER_OPEN_ID: 'admin-local',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || genspark.apiKey || '',
        OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || genspark.baseUrl || '',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    }
  ]
}
