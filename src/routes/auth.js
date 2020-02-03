const Router = require('express-promise-router')
const router = new Router()
const bcrypt = require('bcryptjs')

module.exports = function(options) {
	let {config, mongo, mdlwr, __} = options

	async function getAccessToken() {
		return await __.uniqueIDv2(32)
	}

/* routes */
	router.post('/setup', mdlwr.MUST_NOT_BE_INITIATED, async (req, res) => {
		let form = req.body
		if(!form.login || !form.password) return res.json({success: false, error: 'No login or password provided'})
		form.login = form.login.trim()
		form.password = form.password.trim()

		if(form.login.length < 6) return res.json({success: false, error: 'Login must be at least 6 characters long'})
		if(form.password.length < 6) return res.json({success: false, error: 'Password must be at least 6 characters long'})

		form.password = await bcrypt.hash(form.password, 13)
		let accessToken = await getAccessToken()

		let item = new mongo.User({
            login: form.login,
            password: form.password,
            token: accessToken,
            role: 'admin'
        })
        let user = await item.save()
        
        config.APP_INITIATED = true
		res.json({
			success: true,
			accessToken
		})
	})

	router.post('/login', mdlwr.MUST_BE_INITIATED, async (req, res) => {
		let form = req.body
		if(!form.login || !form.password) return res.json({success: false, error: 'No login or password provided'})
		form.login = form.login.trim()
		form.password = form.password.trim()
		
		let user = await mongo.User.findOne({login: form.login}).exec()
		if(!user || !user.password) return res.json({success: false, error: 'Login or password are incorrect'})

		let compare = await bcrypt.compare(form.password, user.password)
		if(!compare) return res.json({success: false, error: 'Login or password are incorrect'})
		
		let accessToken = await getAccessToken()
		user.token = accessToken
		await user.save()

		res.json({
			success: true,
			accessToken
		})
	})

	return router
}