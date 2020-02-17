const Router = require('express-promise-router');
const router = new Router();

module.exports = function(options) {
	let { config, mongo, mdlwr, log, minio, __, _v } = options;

	router.use(mdlwr.MUST_BE_INITIATED);
	router.use(mdlwr.ACCESS_TOKEN);

	async function getAccessKey() {
		return await __.uniqueIDv2(24);
	}

	async function getAccessSecret() {
		return await __.uniqueIDv2(36);
	}

	/* routes */
	router.get('/list', async (req, res) => {
		let query = req.user.role == 'admin' ? {} : { users: req.user._id }
		let domains = await mongo.Domain.find(query) || [];

		return res.json({ success: true, domains });
	});

	/*
		domain
	*/
	router.post('/add', async (req, res) => {
		let form = req.body;

		if(req.user.role != 'admin' && !req.user.settings.canAddDomain)
			return res.json({ success: false, error: 'do_not_have_access_to_add_domains' });

		if (!form.domain) return res.json({ success: false, error: 'no_hostname_provided' });
		form.domain = form.domain.trim();
		if (!_v.isHostname(form.domain)) return res.json({ success: false, error: 'wrong_hostname_format' });
		if (await mongo.Domain.domainExists(form.domain))
			return res.json({ success: false, error: 'hostname_already_exist' });

		let accessKey = await getAccessKey();
		let accessSecret = await getAccessSecret();

		var [err] = await __.to(minio.makeBucket(form.domain));
		if (err) {
			log.debug('/domain/add', 'Minio error', err.message);
			return res.json({ success: false, error: 'hostname_create_storage_error' });
		}

		let item = new mongo.Domain({
			domain: form.domain,
			users: req.user._id,
			accessKey,
			accessSecret,
		});
		var [err, domain] = await __.to(item.save());
		if(err) {
			log.error('/domain/add', 'Mongo error', err.message);
			return res.json({ success: false, error: 'save_domain_error' });
		}

		return res.json({ success: true, domain });
	});

	router.post('/edit', async (req, res) => {
		let form = req.body;

		if (!form.domain) return res.json({ success: false, error: 'no_domain_provided' });
		form.domain = form.domain.trim();

		let domain = await mongo.Domain.findOne({ domain: form.domain })
		if(!domain)
			return res.json({ success: false, error: 'no_domain_found' });

		if(req.user.role != 'admin' && domain.users.indexOf(req.user._id) == -1)
			return res.json({ success: false, error: 'no_access' });

		let domainChanged = false
		if(form.users && Array.isArray(form.users)) {
			if(form.users.length == 0) {
				domain.users = []
				domainChanged = true
			} else {
				let usersExist = true
				await __.asyncForEach(form.users, async (user) => {
					if(! await mongo.User.userIdExists(user)) usersExist = false
				})
				if(usersExist) {
					domain.users = form.users
					domainChanged = true
				}
			}			
		}

		if(form.referer && Array.isArray(form.referer) && form.referer.length) {
			domain.settings.referer = form.referer
			domainChanged = true
		}

		if(typeof form.ttl == 'number') {
			domain.settings.ttl = form.ttl
			domainChanged = true
		}

		if(typeof form.maxSize == 'number' && req.user.role == 'admin') {
			domain.adminSettings.maxSize = form.maxSize
			domainChanged = true
		}

		if(domainChanged) await domain.save();

		res.json({
			success: true,
			domainChanged,
			domain: domain.domain
		});
	});

	router.get('/id/:domain', async (req, res) => {
		if (!req.params.domain) return res.json({ success: false, error: 'no_hostname_provided' });
		req.params.domain = req.params.domain.trim();

		let query = req.user.role == 'admin' ? {domain: req.params.domain} : { users: req.user._id, domain: req.params.domain }
		let domain = (await mongo.Domain.findOne(query).exec()) || {};

		return res.json({ success: true, domain });
	});

	return router;
};
