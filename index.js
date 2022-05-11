import nanoparse from 'nanoparse';
import color from 'planckcolors';

import init from './init.js';
import run from './run.js';

const args = nanoparse(process.argv.slice(2));
const command = args._[0];

const commands = {
	default: () => {
		console.log(color.bold(color.red('Invalid command!')));
	},
	no_command: () => {
		console.log(color.red('No command detected!'));
		console.log('Run', color.bold(color.green('req help')), 'for more information.');
	},
	help: () => {
		console.log(color.bold(color.green('Available commands:')));
		console.log(color.green('req help                 - Shows this message.'));
		console.log(color.green('req init                 - Initializes a new project.'));
		console.log(color.green('req run <req> [params]   - Runs a request.'));
	},
	init,
	run
}


if (!command) {
	commands.no_command();
} else {
	const the_command = commands[command] || commands.default;
	the_command(args);
}
