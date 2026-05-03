// A11 Test: Multiple Exports for Same Symbol
// Expected: Single MODULE node with multiple export types in metadata
// MODULE: multiple-exports.ts#fetchData
// metadata.exports: ["named", "default"]

function fetchData(endpoint: string) {
  return fetch(endpoint).then(r => r.json());
}

export { fetchData };           // Named export
export default fetchData;       // Also default export

// Another test: class with multiple export paths
class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async get(path: string) {
    return fetch(this.baseUrl + path);
  }
}

export { ApiService };
export default ApiService;

// Expected: 2 MODULE nodes
// - MODULE:multiple-exports.ts#fetchData, exports: ["named", "default"]
// - MODULE:multiple-exports.ts#ApiService, exports: ["named", "default"]