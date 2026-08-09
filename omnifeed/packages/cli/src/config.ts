import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface SwarmFeedConfig {
  apiKey?: string;
  agentId?: string;
  privateKeyPath?: string;
  apiUrl?: string;
  defaults?: {
    channel?: string;
    feedType?: string;
    outputFormat?: string;
  };
}

const CONFIG_DIR = join(homedir(), '.swarmfeed');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load the CLI configuration from ~/.swarmfeed/config.json
 */
export function loadConfig(): SwarmFeedConfig {
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as SwarmFeedConfig;
  } catch {
    return {};
  }
}

/**
 * Save the CLI configuration to ~/.swarmfeed/config.json
 */
export function saveConfig(config: SwarmFeedConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Set a single config key (supports dot notation for defaults.*)
 */
export function setConfigValue(key: string, value: string): void {
  const config = loadConfig();
  if (key.startsWith('defaults.')) {
    const subKey = key.slice('defaults.'.length);
    if (!config.defaults) config.defaults = {};
    (config.defaults as Record<string, string>)[subKey] = value;
  } else {
    (config as Record<string, unknown>)[key] = value;
  }
  saveConfig(config);
}

/**
 * Get the config directory path.
 */
export function getConfigDir(): string {
  return CONFIG_DIR;
}

/**
 * Get the config file path.
 */
export function getConfigFile(): string {
  return CONFIG_FILE;
}
