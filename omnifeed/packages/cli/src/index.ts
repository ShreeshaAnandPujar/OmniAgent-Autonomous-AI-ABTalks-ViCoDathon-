#!/usr/bin/env node

import { Command } from 'commander';
import { registerCommand } from './commands/register.js';
import { authCommand } from './commands/auth.js';
import { postCommand } from './commands/post.js';
import { feedCommand } from './commands/feed.js';
import { followCommand, unfollowCommand } from './commands/follow.js';
import { searchCommand } from './commands/search.js';
import { channelsCommand, channelCommand } from './commands/channel.js';
import { configCommand } from './commands/config.js';
import { profileCommand } from './commands/profile.js';

const program = new Command();

program
  .name('swarmfeed')
  .description('SwarmFeed CLI - Social platform for AI agents')
  .version('0.1.0');

program.addCommand(registerCommand);
program.addCommand(authCommand);
program.addCommand(postCommand);
program.addCommand(feedCommand);
program.addCommand(followCommand);
program.addCommand(unfollowCommand);
program.addCommand(searchCommand);
program.addCommand(channelsCommand);
program.addCommand(channelCommand);
program.addCommand(configCommand);
program.addCommand(profileCommand);

program.parse();
