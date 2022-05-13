import color from 'planckcolors';
import {highlight} from 'cli-highlight';

const makeDoc = s => s.trim()
	.replace(/(\[.+?\])/g, (_, m) => color.yellow(m))
	.replace(/\*(.+?)\*/g, (_, m) => color.bold(m))
	.replace(/\|(.+?)\|/g, (_, m) => color.dim(m))
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

See 'req help walkthrough' for a quick walkthrough.
`)
}

const h = {
	help: makeDoc(`
*req help* - get help

*usage*: req help [help|init|run|request-syntax|walkthrough]

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
	'request-syntax': makeDoc(`
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

If the variable is not provided *AND* there is no default it will be replaced
with an empty string.

Variables are sourced from these places:
1. The '.reqrc' file
2. The command line
3. A flow which passes in the variable

Each source is overwritten by the next.
`),
	walkthrough: makeDoc(`
This walkthrough will help you get started with 'req'.

To get started, run 'req init'. This will create a '.reqrc' and a '.req/' folder
where everything related to 'req' will be stored.

'''console
$ *req* init
$ ls -A
.reqrc .req
'''

Let's take a look at the '.reqrc' file. This file is used to configure req, in 'ini'.
We'll learn more about this later.

The '.req' folder is where the requests and flows are stored. By default a,
sample request is stored in '.req/sample.http', which looks like this:

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

This sends a 'POST' request to 'https://reqres.in/api/users' with the JSON body
provided above. (Learn more about 'http' syntax in 'req help request-syntax')

You can add as many requests and flows to '.req' as you like by creating
multiple files in the '.req' folder.

Let's run the above request. Back in your terminal, run:

'''console
$ *req* run sample
POST *https://reqres.in/api/users*
  *Status:* 201 CREATED
  *Headers* |(14 hidden)|:
    date: Fri, 13 May 2022 05:31:54 GMT
  *Body* |(application/json)|:
    {
      name: "morpheus",
      job: "mentor",
      location: "zion",
      salary: "freedom",
      id: "895",
      createdAt: "2022-05-13T05:31:54.611Z"
    }
'''

'req' shows us the response body, headers, and status code.

Some common headers are hidden, but we can see all of them by passing the
'--all-headers' flag.

'''console
$ *req* run sample --all-headers

POST *https://reqres.in/api/users*
  *Status:* 201 CREATED
  *Headers* |(0 hidden)|:
    access-control-allow-origin: *
    alt-svc: h3=":443"; ma=86400, h3-29=":443"; ma=86400
    cf-cache-status: DYNAMIC
    cf-ray: 70a907fa196a2e52-BOM
    connection: close
    content-length: 121
    content-type: application/json; charset=utf-8
    date: Fri, 13 May 2022 05:35:31 GMT
    etag: W/"79-MEAYpc0MhwHX2uP7lKGAdEBMx8s"
    expect-ct: max-age=604800, report-uri="https://report-uri.cloudflare.com/cdn-cgi/beacon/expect-ct"
    nel: {"success_fraction":0,"report_to":"cf-nel","max_age":604800}
    report-to: {"endpoints":[{"url":"https:\/\/a.nel.cloudflare.com\/report\/v3?s=ntfm%2FdG82lCwNoI1DEY%2Fx%2F%2Bvbj9A%2Fn%2FE0xcyOqXjpQ7WiSA4iG5R%2BOnBjDzZ6CYFs6ltl1TSfVeZMB%2FmGhF1kjhXY%2FRtDz28ItiH37STrIJacYjwcItJ4kBm%2B6E%3D"}],"group":"cf-nel","max_age":604800}
    server: cloudflare
    via: 1.1 vegur
    x-powered-by: Express
  *Body* |(application/json)|:
    {
      name: "morpheus",
      job: "mentor",
      location: "zion",
      salary: "freedom",
      id: "631",
      createdAt: "2022-05-13T05:35:31.120Z"
    }
'''

You can learn more about the 'run' command in 'req help run'.

Lets try creating a new request. Open up '.req/users.http' in your text editor and add this:

'''http
GET https://reqres.in/api/users HTTP/1.1
'''

That's it! We dont need to send any extra headers or body.
Try running the request.

'''console
$ *req* run users
GET *https://reqres.in/api/users*
  *Status:* 200 OK
  *Headers* |(14 hidden)|:
    age: 3548
    content-encoding: br
    date: Fri, 13 May 2022 05:39:57 GMT
    transfer-encoding: chunked
    vary: Accept-Encoding
  *Body* |(application/json)|:
    {
      page: 1,
      per_page: 6,
      total: 12,
      total_pages: 2,
      data: [
        {
          id: 1,
          email: "george.bluth@reqres.in",
          first_name: "George",
          last_name: "Bluth",
          avatar: "https://reqres.in/img/faces/1-image.jpg"
        },
        {
          id: 2,
          email: "janet.weaver@reqres.in",
          first_name: "Janet",
          last_name: "Weaver",
          avatar: "https://reqres.in/img/faces/2-image.jpg"
        },
        {
          id: 3,
          email: "emma.wong@reqres.in",
          first_name: "Emma",
    |...30 more lines (use |[--full-response]| to see the whole response)|
'''

This time, the response body is very long, and is truncated to fit the terminal.
You can see the full response by passing the '--full-response' flag. Try it out!

This request is pretty cool, but we have to change the file manually every time
we want to see a different page. We can change this by adding a variable:

'''http
GET https://reqres.in/api/users?page={page} HTTP/1.1
'''

Now, we can pass the variable to thq request like so:

'''console
$ *req* run users --page 2
			GET *https://reqres.in/api/users?page=2*
  *Status*: 200 OK
  *Headers* |(14 hidden)|:
    age: 5997
    content-encoding: br
    date: Fri, 13 May 2022 05:47:07 GMT
    transfer-encoding: chunked
    vary: Accept-Encoding
  *Body* |(application/json)|:
    {
      page: 2,
      per_page: 6,
      total: 12,
      total_pages: 2,
      data: [
        {
          id: 7,
          email: "michael.lawson@reqres.in",
          first_name: "Michael",
          last_name: "Lawson",
          avatar: "https://reqres.in/img/faces/7-image.jpg"
        },
        {
          id: 8,
          email: "lindsay.ferguson@reqres.in",
          first_name: "Lindsay",
          last_name: "Ferguson",
          avatar: "https://reqres.in/img/faces/8-image.jpg"
        },
        {
          id: 9,
          email: "tobias.funke@reqres.in",
          first_name: "Tobias",
    |...30 more lines (use |[--full-response]| to see the whole response)|
'''

This time, we can see the second page of results.
You can learn more about variables in 'req help variables'.
`),
	flow: makeDoc(`
Flows are an upcoming feature. I've referred to the them many times in this doc but im too lazy to change lmao.
`)
}

function helpFor(thing) {
	return h[thing] ?? makeDoc(`No help for '${thing}'`);
}
