import color from 'planckcolors';
import {join, resolve} from 'path';
import {readdirSync, readFileSync} from 'fs';
import {parse} from './parse.js';
import {getVariables} from './config.js';
import {inspect} from 'util';
import fetch from 'node-fetch';
import unbug from 'unbug';
import fuzzysort from 'fuzzysort';

const debug = unbug('run');

const STATUSES = {
	100: 'CONTINUE',
	101: 'SWITCHING PROTOCOLS',
	102: 'PROCESSING',
	103: 'EARLY HINTS',

	200: 'OK',
	201: 'CREATED',
	202: 'ACCEPTED',
	203: 'NON-AUTHORITATIVE INFORMATION',
	204: 'NO CONTENT',
	205: 'RESET CONTENT',
	206: 'PARTIAL CONTENT',
	207: 'MULTI-STATUS',
	208: 'ALREADY REPORTED',
	226: 'IM USED',

	300: 'MULTIPLE CHOICES',
	301: 'MOVED PERMANENTLY',
	302: 'FOUND',
	303: 'SEE OTHER',
	304: 'NOT MODIFIED',
	305: 'USE PROXY DEPRECATED',
	306: 'UNUSED',
	307: 'TEMPORARY REDIRECT',
	308: 'PERMANENT REDIRECT',

	400: 'BAD REQUEST',
	401: 'UNAUTHORIZED',
	402: 'PAYMENT REQUIRED',
	403: 'FORBIDDEN',
	404: 'NOT FOUND',
	405: 'METHOD NOT ALLOWED',
	406: 'NOT ACCEPTABLE',
	407: 'PROXY AUTHENTICATION REQUIRED',
	408: 'REQUEST TIMEOUT',
	409: 'CONFLICT',
	410: 'GONE',
	411: 'LENGTH REQUIRED',
	412: 'PRECONDITION FAILED',
	413: 'PAYLOAD TOO LARGE',
	414: 'URI TOO LONG',
	415: 'UNSUPPORTED MEDIA TYPE',
	416: 'RANGE NOT SATISFIABLE',
	417: 'EXPECTATION FAILED',
	418: 'I\'M A TEAPOT',
	421: 'MISDIRECTED REQUEST',
	422: 'UNPROCESSABLE ENTITY',
	423: 'LOCKED',
	424: 'FAILED DEPENDENCY',
	425: 'TOO EARLY EXPERIMENTAL',
	426: 'UPGRADE REQUIRED',
	428: 'PRECONDITION REQUIRED',
	429: 'TOO MANY REQUESTS',
	431: 'REQUEST HEADER FIELDS TOO LARGE',
	451: 'UNAVAILABLE FOR LEGAL REASONS',

	500: 'INTERNAL SERVER ERROR',
	501: 'NOT IMPLEMENTED',
	502: 'BAD GATEWAY',
	503: 'SERVICE UNAVAILABLE',
	504: 'GATEWAY TIMEOUT',
	505: 'HTTP VERSION NOT SUPPORTED',
	506: 'VARIANT ALSO NEGOTIATES',
	507: 'INSUFFICIENT STORAGE',
	508: 'LOOP DETECTED',
	510: 'NOT EXTENDED',
	511: 'NETWORK AUTHENTICATION REQUIRED',
}

const __dirname = process.cwd();

export default function run(args) {
	const file = args._[1];
	debug('Running file', file)

	if (!file) {
		console.error(color.red('No file specified!'));
		process.exit(1);
	}

	const path = resolve(__dirname, '.req', `${file}.http`);
	debug('Reading', path)
	let content;

	try {
		content = readFileSync(path, 'utf8');
	} catch (e) {
		debug('Error reading:', e)
		if (e.code === 'ENOENT') {
			console.error(color.red(`Request ${file} not found!`));
			try {
				const allTheFiles = readdirSync(join(__dirname, '.req')).map(k => k.split('.')[0])
				const similar = fuzzysort.go(file, allTheFiles)
				const hl = similar.map(k => '\t' + fuzzysort.highlight(k, '\x1b[31m', '\x1B[0m'))
				if (similar.length) {
					console.log()
					console.log('Did you mean:')
					console.log(hl.join('\n'))
				}
			} catch (e) {
				console.error(color.red(`The .req directory does not exist. Did you forget to initialize?`))
			}
			process.exit(1);
		}

		throw e;
	}

	let {method, headers, body, url} = parse(content);
	debug('Method is', method)
	debug('Headers are', headers)
	debug('Body is', body)
	debug('URL is', url)

	if (method === 'GET' || method === 'HEAD') {
		if (body) {
			body = undefined;
			console.error(color.cyan(`Note: body ignored for ${method} request`));
		}
	}

	let showFullResponse;
	let showFullHeaders;

	if (args.flags.full) {
		showFullResponse = true;
		showFullHeaders = true;
		delete args.flags.full;
	}

	if ('all-headers' in args.flags) {
		showFullHeaders = args.flags['all-headers'];
		delete args.flags['all-headers'];
	}

	if ('full-response' in args.flags) {
		showFullResponse = args.flags['full-response'];
		delete args.flags['full-response'];
	}

	const variables = Object.assign({}, getVariables(), args.flags);
	const addVariables = x => x.replace(/{(\w+)[ \t]*(?:\|[ \t]*(.+))?}/g, (_, key, def) => variables[key] ?? def ?? '')

	url = addVariables(url);
	Object.keys(headers).forEach(key => headers[key] = addVariables(headers[key]))
	if (typeof body === 'object') Object.keys(body).forEach(key => body[key] = addVariables(body[key]))
	if (typeof body === 'string') body = addVariables(body);

	fetch(url, {method, headers, body}).then(async res => {
		try {
			return {
				status: res.status,
				headers: Object.fromEntries(res.headers.entries()),
				body: await res.clone().json()
			}
		} catch (e) {
			return {
				status: res.status,
				headers: Object.fromEntries(res.headers.entries()),
				body: await res.text()
			}
		}
	}).then(res => {
		console.log(colorMethod(method), color.bold(url))

		console.log(color.bold('  Status:'), colorStatus(res.status + ' ' + STATUSES[res.status] ?? 'UNKNOWN'));

		const hidden = Object.fromEntries(Object.entries(res.headers).filter(commonHiddenFilters(showFullHeaders)))
		const hiddenLength = Object.keys(res.headers).length - Object.keys(hidden).length;
		console.log(color.bold('  Headers'), color.dim(`(${hiddenLength} hidden)`) + color.bold(':'));

		Object.entries(hidden).forEach(([key, value]) => {
			console.log(`    ${key}: ${value}`);
		});

		let type = res.headers['content-type'];
		if (type) type = type.split(';')[0].trim();
		console.log(color.bold('  Body') + color.dim(type ? ` (${type})` : '') + color.bold(':'));

		const inspected = inspect(res.body, {depth: null, colors: true, maxStringLength: showFullResponse ? Infinity : 1000, maxArrayLength: showFullResponse ? Infinity : 100})
		const sliceLength = process.stdout.rows - (10 + Object.keys(hidden).length);
		
		console.log(
			inspected
				.split('\n')
				.slice(0, showFullResponse ? Infinity : sliceLength)
				.map(line => '    ' + line)
				.join('\n')
		);

		if (inspected.split('\n').length > sliceLength) {
			console.log(color.dim( `    ...${inspected.split('\n').length - sliceLength} more lines (use`), color.yellow('--full-response'), color.dim('to see the whole response)'))
		}
	}).catch(e => {
		console.error(color.red('Failed to fetch!'))

		if (e.message.toLowerCase().includes('invalid url')) console.error('You passed an invalid URL!')
		else console.error(e.name + ': ' + e.message);

		process.exit(1)
	})
}

function commonHiddenFilters(show) {
	return show ? () => true : ([k]) => {
		const hidden = [
			'nel', 'server', 'via', 'x-powered-by', 'alt-svc', 'connection', 'content-length', 'etag', 'report-to', 'expect-ct', 'content-type',
			'set-cookie', 'expires', 'p3p', 'cache-control'
		];

		k = k.toLowerCase();
		if (k.startsWith('access-control')) return false;
		if (k.startsWith('cf-')) return false;
		if (hidden.includes(k)) return false;
		return true;
	}
}

function colorStatus(status) {
	if (status === '418 I\'M A TEAPOT') return randomColor(status);
	return {
		2: color.green(status),
		3: color.yellow(status),
		4: color.red(status),
		5: color.red(status)
	}[Math.floor((+status.split(' ')[0]) / 100)] ?? status;
}

function colorMethod(method) {
	const c = {
		get: color.green,
		post: color.yellow,
		put: color.cyan,
		delete: color.red
	}[method.toLowerCase()] ?? color.bold;
	return c(method);
}

function randomColor(str) {
	const colors = [
		color.magenta,
		color.blue,
		color.green,
		color.yellow,
		color.red,
		color.yellow,
		color.green,
		color.blue
	]

	return str.split('').map((c, i) => colors[i % colors.length](c)).join('')
}
