import { createApp } from './app.js';
import { config, APP_VERSION } from './config.js';

const app = createApp();
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Hospital Mitra API v${APP_VERSION} listening on http://0.0.0.0:${config.port}`);
  console.log(`CORS origins: ${config.corsOrigins.join(', ')}`);
  console.log('Admin demo credentials are seeded on first run (see docs/SETUP.md).');
});

function shutdown() {
  console.log('\nShutting down...');
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
