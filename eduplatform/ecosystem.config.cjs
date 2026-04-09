module.exports = {
  apps: [
    {
      name: "sca-eduplatform",
      script: "server.ts",
      interpreter: "node",
      interpreter_args: "--import tsx/esm",
      node_args: "--max-old-space-size=4096",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Restart if memory exceeds 1.5 GB
      max_memory_restart: "1500M",
      // Restart on crash
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      // Logging
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
