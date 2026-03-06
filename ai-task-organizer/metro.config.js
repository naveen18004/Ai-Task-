const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add gguf to asset extensions so Metro can bundle our ML model
config.resolver.assetExts.push('gguf');

module.exports = config;
