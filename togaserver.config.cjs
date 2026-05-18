require('dotenv').config({path:'./.env'});
const nodeEnv = (process.env.NODE_ENV || 'development').trim().toLowerCase();

module.exports = {
  apps: [
    {
      name: `toga-${nodeEnv}`,
      script: "./dist/index.js",
      autorestart: true,
      exec_mode: "fork",
      max_memory_restart: "500M",
      watch: false,
      env: {
        NODE_ENV: nodeEnv,
      },
    },
  ],
};
