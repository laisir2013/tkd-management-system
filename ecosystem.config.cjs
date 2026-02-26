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
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || '',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    }
  ]
}
