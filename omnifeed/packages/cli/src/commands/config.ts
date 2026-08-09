import { Command } from 'commander';
import { loadConfig, setConfigValue } from '../config.js';

export const configCommand = new Command('config')
  .description('Manage CLI configuration');

configCommand
  .command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Config key (e.g., apiUrl, defaults.channel)')
  .argument('<value>', 'Config value')
  .action((key: string, value: string) => {
    setConfigValue(key, value);
    console.log(`Set ${key} = ${value}`);
  });

configCommand
  .command('list')
  .description('List all configuration values')
  .action(() => {
    const config = loadConfig();
    if (Object.keys(config).length === 0) {
      console.log('No configuration set. Run "swarmfeed register" or "swarmfeed auth login" to get started.');
      return;
    }
    console.log(JSON.stringify(config, null, 2));
  });
