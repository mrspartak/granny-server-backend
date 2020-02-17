const Router = require('express-promise-router');
const router = new Router();
const bcrypt = require('bcryptjs');

module.exports = function(options) {
	let { config, mongo, mdlwr, log, minio, __, _v } = options;

	router.use(mdlwr.MUST_BE_INITIATED);
	router.use(mdlwr.ACCESS_TOKEN);
	router.use(mdlwr.ADMIN_ACCESS);

	async function getAccessToken() {
		return await __.uniqueIDv2(32);
	}

	/* routes */
	router.get('/list', async (req, res) => {
		let users = await mongo.User.find().select('-password -token') || [];



		return res.json({ success: true, users });
	});


	router.post('/add', async (req, res) => {
		let form = req.body;

		if (!form.login) return res.json({ success: false, error: 'no_login_provided' });
		form.login = form.login.trim();
		if (form.login.length < 6)
			return res.json({ success: false, error: 'Login must be at least 6 characters long' });

		if (!form.password) return res.json({ success: false, error: 'no_password_provided' });
		form.password = form.password.trim();
		if (form.password.length < 6)
			return res.json({ success: false, error: 'Password must be at least 6 characters long' });

		form.role = form.role ? form.role : 'client'
		if(!mongo.desc.userRoleDescription.roles[form.role])
			return res.json({ success: false, error: 'invalid_role_provided' });

		if (await mongo.User.userExists(form.login))
			return res.json({ success: false, error: 'user_already_exist' });

		form.password = await bcrypt.hash(form.password, 13);
		let accessToken = await getAccessToken();

		let item = new mongo.User({
			login: form.login,
			password: form.password,
			token: accessToken,
			role: form.role
		});
		let user = await item.save();

		res.json({
			success: true,
			login: user.login
		});
	});

	router.post('/edit', async (req, res) => {
		let form = req.body;

		if (!form.login) return res.json({ success: false, error: 'no_login_provided' });
		form.login = form.login.trim();

		let user = await mongo.User.findOne({ login: form.login })
		if(!user)
			return res.json({ success: false, error: 'no user found' });

		let userChanged = false
		if(form.password) {
			form.password = form.password.trim();
			if (form.password.length < 6)
				return res.json({ success: false, error: 'Password must be at least 6 characters long' });

			user.password = await bcrypt.hash(form.password, 13);
			user.accessToken = await getAccessToken();
			userChanged = true
		}

		if(form.role) {
			form.role = form.role.trim();
			if(!mongo.desc.userRoleDescription.roles[form.role])
				return res.json({ success: false, error: 'invalid_role_provided' });

			user.role = form.role
			userChanged = true
		}

		if(form.domains && Array.isArray(form.domains)) {
			if(form.domains.length == 0) {
				user.domains = []
				userChanged = true
			} else {
				let domainsExist = true
				await __.asyncForEach(form.domains, async (domain) => {
					if(! await mongo.Domain.domainIdExists(domain)) domainsExist = false
				})
				if(domainsExist) {
					user.domains = form.domains
					userChanged = true
				}
			}			
		}

		if(typeof form.canAddDomains != 'undefined') {
			form.canAddDomains = !!form.canAddDomains

			user.settings.canAddDomains = form.canAddDomains
			userChanged = true
		}

		if(userChanged) await user.save();

		res.json({
			success: true,
			userChanged,
			login: user.login
		});
	});


	router.get('/id/:login', async (req, res) => {
		if (!req.params.login) return res.json({ success: false, error: 'no_login_provided' });
		req.params.login = req.params.login.trim();

		let user = (await mongo.User.findOne({ login: req.params.login }).select('-password -token').exec()) || {};

		return res.json({ success: true, user });
	});

	return router;
};
