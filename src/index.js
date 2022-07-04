#!/usr/bin/env node

import nanoparse from 'nanoparse';
import color from 'planckcolors';
import fuzzysort from 'fuzzysort';

import './warning.js';

import init from './init.js';
import run from './run.js';
import help from './help.js';
import { readFileSync } from "fs";


const args = nanoparse(process.argv.slice(2));
const command = args._[0];

const commands = {
	default: (c) => {
		console.log(color.bold(color.red('Invalid command!')));

		const allCommands = ['help', 'init', 'run', 'version'];
		const similar = fuzzysort.go(c, allCommands)
		const hl = similar.map(k => '\t' + fuzzysort.highlight(k, '\x1b[31m', '\x1B[0m'))

		console.log()
		if (similar.length > 0) {
			console.log('Did you mean:')
			console.log(hl.join('\n'))
		} else {
			console.log('Available commands:')
			console.log(allCommands.map(k => '\t' + k).join('\n'))
		}
	},
	noCommand: () => {
		console.log(color.red('No command detected!'));
		console.log('Run', color.bold(color.green('req help')), 'for more information.');
	},
	help,
	init,
	run,
	async version() {
		const packageJson = JSON.parse(readFileSync(require.resolve("../package.json")).toString());
		const {version} = packageJson.default
		console.log(
			'req', `v${version}`
		);
	},
}

commands.v = commands.version;

if (!command) {
	commands.noCommand();
} else {
	const theCommand = commands[command];
	if (theCommand) theCommand(args);
	else commands.default(command);
}
