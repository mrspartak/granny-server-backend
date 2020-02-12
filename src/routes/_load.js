const crypto = require('crypto')

module.exports = async function(options){
	let {__, _, mongo, app, log, config} = options

	//initiating app
	config.APP_INITIATED = await mongo.User.adminExists()
	log.info('APP_INITIATED', config.APP_INITIATED)

	//middleware
	options.mdlwr = {}

	options.mdlwr.MUST_BE_INITIATED = async function(req, res, next) {
		if(!config.APP_INITIATED) {
			config.APP_INITIATED = await mongo.User.adminExists()
		}

		if(config.APP_INITIATED) return next()

		return res.json({
			succes: false,
			error: 'app_not_initiated'
		})
	}
	options.mdlwr.MUST_NOT_BE_INITIATED = async function(req, res, next) {
		if(!config.APP_INITIATED) {
			config.APP_INITIATED = await mongo.User.adminExists()
		}

		if(!config.APP_INITIATED) return next()

		return res.json({
			succes: false,
			error: 'app_initiated'
		})
	}

	options.mdlwr.ACCESS_TOKEN = async function(req, res, next) {
		var [err, user] = await __.to( mongo.User.checkRequestToken(req) )
		if(err) return res.json({succes: false, error: err.message})

		req.user = user
		next()
	}

	options.mdlwr.ACCESS_KEY_SECRET = async function(req, res, next) {
		var sign = req.method == 'POST' ? req.body.sign : req.query.sign
		log.debug('ACCESS_KEY_SECRET', req.method, req.body, req.query)
		if(!sign) return res.json({succes: false, error: 'authorization_required', error_code: 1})

		var [key, sign] = sign.split('||')
		log.debug('ACCESS_KEY_SECRET', key, sign)

		let domain = await mongo.Domain.findOne({accessKey: key}).exec()
		if(!domain) return res.json({succes: false, error: 'authorization_required', error_code: 2})

		let signCheck = crypto.createHmac('sha1', domain.accessSecret).update(domain.accessKey).digest('hex')
		if(signCheck != sign) return res.json({succes: false, error: 'authorization_required', error_code: 3})

		req.domain = domain
		next()
	}


	//load modules dynamicaly
	let modules = __.modulesAt(__.path('src/routes/'), {
		camelCase: false,
		capitalize: false
	})

	_.each(modules, (module) => {
		if(module.name == '_load') return

		options.moduleName = module.name
		if(module.name == 'index') module.name = ''

		app.use('/'+ module.name, require(module.path)(options))
	})

	return app
}