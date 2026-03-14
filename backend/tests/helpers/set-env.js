'use strict';

// Imposta NODE_ENV=test prima che dotenv carichi il file .env
// In questo modo dotenv (con override: false) non sovrascriverà questa variabile
process.env.NODE_ENV = 'test';
