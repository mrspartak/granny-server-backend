let _tsStart = new Date().getTime();

(async () => {
	const {app, config, log} = await require('./src/server.js')()

	app.listen(config.APP_PORT, () => {
		let startDiff = ((new Date().getTime() - _tsStart) / 1000).toFixed(2);
		log.info({ place: 'index', breakPoint: 'appStart', message: `Started in ${startDiff} sec | Listening http://127.0.0.1:${config.APP_PORT}`, time: startDiff });
	})
})()