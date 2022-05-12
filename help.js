import color from 'planckcolors';
import {highlight} from 'cli-highlight';

const makeDoc = s => s.trim()
	.replace(/(\[.+?\])/g, (_, m) => color.yellow(m))
	.replace(/\*(.+?)\*/g, (_, m) => color.bold(m))
	.replace(/(<.+?>)/g, (_, m) => color.red(m))
	.replace(/'''([a-z]+)([\s\S]+?)'''/gim, (_, language, code) => {
		if (language === 'http') {
			return code
				.replace(/({[\s\S]+})/g, (_, m) => highlight(m, {language: 'json'}))
				.replace(/(#.+)/g, color.dim('$1'))
				.replace(/^([A-Z-]+) ([^ ]+) (HTTP\/\d\.\d)$/gm, (color.yellow('$1 ')) + color.red('$2 ') + color.dim('$3'))
				.replace(/^([^: \t]+:[ \t]*)((?:.*[^ \t])|)/gm, color.yellow('$1') + '$2')
				.replace(/({.+?})/g, (_, m) => color.magenta(m))
				.split('\n')
				.map(line => '\t' + line)
				.join('\n')
		}

		return highlight(code, {language})
		.replace(/(;.+)/g, color.dim('$1'))
				.split('\n')
				.map(line => '\t' + line)
				.join('\n')
	})
	.replace(/'(.+?)'/g, (_, m) => color.blackBg(color.red(` ${m} `)))

export default function help(args) {
	const command = args._[1];

	if (command) console.log(helpFor(command))
	else console.log(genericHelp());
}

function genericHelp() {
	return makeDoc(`
*req* - fast API testing

*usage*: req <command> [args]

*commands*:
	help [thing] - view the help for [thing]
	init           - initalize req in the current directory
	run <request>  - run an http request or flow

See 'req help tutorial' for a quick tutorial
`)
}

const h = {
	help: makeDoc(`
*req help* - get help

*usage*: req help [help|init|run|http-syntax]

Gives you help on the given command.`),
	init: makeDoc(`
*req init* - initalize req in the current directory
	
*usage*: req init

Initializes req in the current directory. Creates a '.reqrc' and a '.req/'
folder with a sample request '.req/sample.http'
`),
	run: makeDoc(`
*req run* - run a request or flow

*usage*: req run <request or flow> [--full] [--full-response] [--all-headers] [--any variables]

Runs a request or a flow. It runs '.req/name.http' or '.req/name.flow', with
requests taking priority over flows.

The response body will be truncated to screen size, and common headers will be hidden.
If you pass the [--full-response] flag, the response body will not be truncated.
If you pass the [--all-headers] flag, all headers will be shown.
the [--full] flag is an alias for both flags.

All the other flags will be passed as 'variables' ('req help variables')
`),
	'http-syntax': makeDoc(`
All requests in *req* are stored as '.http' files in the '.req' folder.

HTTP files look like this:

'''http
# Sample req file
POST https://reqres.in/api/users HTTP/1.1
Content-Type: application/json

{
	"name": "morpheus",
	"job": "mentor",
	"location": "zion",
	"salary": "freedom"
}
'''

This will send a 'POST' request to 'https://reqres.in/api/users', using 'HTTP'
version '1.1' with the given body

You can also use variables ('req help variables') in your http files like so:

'''http
GET https://reqres.in/api/users?page={page} HTTP/1.1
'''

You can pass in the value for the variable from the command line ('req help run') or
in the '.reqrc' ('req help reqrc')

Default values are also supported:

'''http
GET https://reqres.in/api/users?page={page|1} HTTP/1.1
'''

Here, if 'page' is not provided, the default of 1 will be used

You can "continue" long headers by indenting the next line:

'''http
GET https://example.com HTTP/1.1
Set-Cookie: k=v;
    SameSite=strict
'''

Here, the third line is part of the 'Set-Cookie' header
You can also continue the url like so.
`),
	reqrc: makeDoc(`
The '.reqrc' file is used to configure req. It is an 'ini' file.
For now, it supports only setting global variables.

'''ini
[variables]
	api_base = https://api.example.com/
	page = 1; in case we forget to pass this somewhere 
'''
`),
	variables: makeDoc(`
Variables are one of the key features of req which turns req from a http client
to a fully-fledged API testing tool.

You can embed a variable in the URL, the body, and the header values. Variable
syntax is '{variable_name}'. You can also provide default values with
'{name|default}' where if the name variable is not provided the default
will be used.

If the variable is not provided *AND* there is no default it will be replaced with an empty string
`)
}

function helpFor(thing) {
	return h[thing] ?? makeDoc(`No help for '${thing}'`);
}
