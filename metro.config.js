const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add wasm asset support (expo-sqlite web uses a WASM build)
config.resolver.assetExts.push('wasm');

// Add COEP and COOP headers to support SharedArrayBuffer, required by
// expo-sqlite's web (WASM) build. This only affects the local dev server
// (`expo start --web`) — the deployed static export needs the same headers
// set by the host itself (see public/_headers for Cloudflare Pages).
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
