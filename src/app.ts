import express from 'express';
import { createApp } from './create-app.js';
import { loadConfig } from './config.js';

export default createApp(loadConfig(), express());
