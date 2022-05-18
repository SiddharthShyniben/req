import {statSync} from 'fs';
import {resolve} from 'path';

import color from 'planckcolors';
import fetch from 'node-fetch';

export const isInitialized = (dir) => {
	try {
		const dirStats = statSync(resolve(dir, '.req'));
		const reqDirExists = dirStats.isDirectory();

		const configFile = statSync(resolve(dir, '.reqrc'));
		const configFileExists = configFile.isFile();

		return reqDirExists && configFileExists;
	} catch {
		return false;
	}
}

export const STATUSES = {
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

export const colorStatus = status => status === '418 I\'M A TEAPOT' ? randomColor(status) : {
	2: color.green(status),
	3: color.yellow(status),
	4: color.red(status),
	5: color.red(status)
}[Math.floor((+status.split(' ')[0]) / 100)] ?? status;

export const colorMethod = method => ({
	get: color.green,
	post: color.yellow,
	put: color.cyan,
	delete: color.red
}[method.toLowerCase()] ?? color.bold)(method);

export const colors = [
	color.magenta,
	color.blue,
	color.green,
	color.yellow,
	color.red,
	color.yellow,
	color.green,
	color.blue
]

export const randomColor = str => str.split('').map((c, i) => colors[i % colors.length](c)).join('')

const cwd = process.cwd();

export const getRequestByName = name => {
	let path = resolve(cwd, '.req', `${name}.http`);

	if (existsSync(path)) {
		const content = readFileSync(path, 'utf8');
		return {type: 'http', content};
	}

	path = resolve(cwd, '.req', `${name}.flow.js`);

	if (existsSync(path)) {
		const content = readFileSync(path, 'utf8');
		return {type: 'flow', content};
	}

	return null;
}

export const prepFetch = ({method, url, headers, body}) => fetch(url, {method, headers, body}).then(async res => {
	let body;

	try {
		body = await res.clone().json();
	} catch {
		body = await res.text();
	}

	return {
		status: res.status,
		headers: Object.fromEntries(res.headers.entries()),
		body
	};
});
