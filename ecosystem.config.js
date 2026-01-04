module.exports = {
  apps: [
    {
      name: "kakamalem",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/var/www/kakamalem",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/www/kakamalem/logs/err.log",
      out_file: "/var/www/kakamalem/logs/out.log",
      log_file: "/var/www/kakamalem/logs/combined.log",
      time: true,
      max_memory_restart: "1G",
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
