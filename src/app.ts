import { createApp } from './create-app.js';
import { loadConfig } from './config.js';

// Vercel serves this Express instance without starting a local listener.
export default createApp(loadConfig());
