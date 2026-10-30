import { createApp } from './app.js';
import { loadConfig } from './config.js';

try {
  const config = loadConfig();
  const server = createApp(config).listen(config.PORT, config.HOST, () => {
    console.log(`TherapyDesk listening on ${config.HOST}:${config.PORT}`);
  });
  server.on('error', () => {
    console.error('Unable to start HTTP server. Check the host and port.');
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    });
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Server startup failed.',
  );
  process.exitCode = 1;
}
