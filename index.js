(async () => {
	const {app, config, log} = await require('./src/server.js')()

	app.listen(config.APP_PORT, () => {
		log.info('App listening on port ', config.APP_PORT)
	})
})()



