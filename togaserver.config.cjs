const env = require('dotenv').config({path:'./.env'});

module.exports = {
  apps: [
    {
      name: `toga-${process.env.RUNNING_ENV || 'development'}`,
      script: "./dist/index.js",
      autorestart: true,
      exec_mode: "fork",
      max_memory_restart: "500M",
      watch: false,
    },
  ],
};
