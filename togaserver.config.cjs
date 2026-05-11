const env = require('dotenv').config({path:'./.env'});
const nodeEnv = env.parsed?.NODE_ENV || 'development';

module.exports = {
  apps: [
    {
      name: `toga-${nodeEnv}`,
      script: "./dist/index.js",
      autorestart: true,
      exec_mode: "fork",
      max_memory_restart: "500M",
      watch: false,
    },
  ],
};
