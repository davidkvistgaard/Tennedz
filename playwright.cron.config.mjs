import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/cron',workers:1,retries:0,
  globalTeardown:'./tests/support/cron-teardown.mjs',
  use:{baseURL:'http://localhost:3102',channel:process.platform==='win32'?'msedge':'chromium'},
  webServer:{command:'node tests/support/cron-server.mjs',url:'http://localhost:3102/login',
    reuseExistingServer:false,timeout:60000,
    gracefulShutdown:{signal:'SIGTERM',timeout:3000}},
});
