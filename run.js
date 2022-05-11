import color from 'planckcolors';
import {dirname, resolve} from 'path';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {getVariables} from './config.js';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function run(args) {
	const file = args._[1];

	if (!file) {
		console.error(color.red('No file specified!'));
		process.exit(1);
	}

	const path = resolve(__dirname, '.req', `${file}.http`);
	let content;

	try {
		content = readFileSync(path, 'utf8');
	} catch (e) {
		if (e.code === 'ENOENT') {
			console.error(color.red(`Request ${file} not found!`));
			process.exit(1);
		}

		throw e;
	}

	const lines = content.split('\n').map(line => line.trim()).filter(line => !line.startsWith('#'));
	let [method, url] = lines[0].split(' ');

	if (!HTTP_METHODS.includes(method)) {
		console.error(color.red(`Invalid method ${method}!`));
		console.error('Valid methods:', HTTP_METHODS.join(', '));
		process.exit(1);
	}

	if (!method || !url) {
		console.error(color.red('Invalid request file!'));
		console.error('First line must be in the format:', color.green('METHOD URL'));
		console.error('Example:', color.bold('GET https://google.com/'));
		console.error('Example:', color.bold('POST https://api.github.com/repos/planck-js/planck-js/issues'));
		process.exit(1);
	}

	const headers = {};
	let i;
	for (i = 1; i < lines.length; i++) {
		if (lines[i] === '') break;

		const [key, value] = lines[i].split(':').map(s => s.trim());
		if (!key || !value) {
			console.error(color.red('Invalid request file!'));
			console.error('Error on line', color.green(i + 1), ':', color.red('Invalid header'));
			console.error('Headers must be in the format:', color.green('KEY: VALUE'));
			console.error('Example:', color.bold('Content-Type: application/json'));
			console.error('Example:', color.bold('Accept: application/vnd.github.v3+json'));
			process.exit(1);
		}

		headers[key] = value;
	}

	let body = parseBody(lines.slice(i + 1).join('\n').trim());

	const variables = Object.assign({}, getVariables(), args.flags);
	Object.entries(variables).forEach(([v, val]) => {
		url = url.replaceAll(`{${v}}`, val);
		if (body) Object.keys(body).forEach(key => {
			body[key] = body[key].replaceAll(`{${v}}`, val);
		});
	});

	fetch(url, {
		method,
		headers,
		body: body ? JSON.stringify(body) : body
	}).then(async res => {
		try {
			return await res.json();
		} catch (e) {
			return await res.text();
		}
	}).then(res => {
		console.log('Got response:', res);
	})
}

function parseBody(body) {
	try {
		return JSON.parse(body.replace(/\/\/.*/g, ''));
	} catch (e) {
		return undefined;
	}
}
