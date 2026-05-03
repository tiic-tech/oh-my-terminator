// A12 Test: Named Default Export
// Expected MODULE node: name="getConfig", id="MODULE:named-default.ts#getConfig"
// Expected metadata: { exports: ["default"], namedDefault: true }

export default function getConfig() {
  return {
    apiUrl: 'https://api.example.com',
    timeout: 5000,
    retries: 3,
  };
}

// Named default export with explicit name
// Consumers can: import getConfig from './named-default'
//           or: import myConfig from './named-default' (rename at import)
// Parser should preserve original name "getConfig" in MODULE node