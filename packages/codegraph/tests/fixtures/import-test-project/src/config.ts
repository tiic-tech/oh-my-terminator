/**
 * Default export example file.
 * Tests default import extraction.
 */

interface Config {
  apiUrl: string;
  timeout: number;
  retries: number;
}

const defaultConfig: Config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3,
};

export default defaultConfig;

// Also has named exports to test mixed imports
export const DEFAULT_TIMEOUT = 5000;
export const DEFAULT_RETRIES = 3;