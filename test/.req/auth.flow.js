(async () => {
	const {body: {token}} = await run('register');
	console.log(`Registered with token ${token}!`);
	console.log('Normally you would now use the API with this token.');
})()
