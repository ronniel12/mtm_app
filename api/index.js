// Single serverless handler for all API routes (Vercel Hobby Plan compatible)
// This bundles all API routes into ONE serverless function instead of 40+ individual functions

const app = require('./server.js');

module.exports = app;
