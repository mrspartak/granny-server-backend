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
		let domains = (await mongo.Domain.find({ user: req.user._id }).exec()) || [];

		return res.json({ success: true, domains });
	});

	/*
		domain
	*/
	router.post('/add', async (req, res) => {
		let form = req.body;

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
			user: req.user._id,
			accessKey,
			accessSecret,
		});
		let domain = await item.save();

		return res.json({ success: true, domain });
	});

	router.get('/id/:domain', async (req, res) => {
		if (!req.params.domain) return res.json({ success: false, error: 'no_hostname_provided' });
		req.params.domain = req.params.domain.trim();

		let domain = (await mongo.Domain.findOne({ user: req.user._id, domain: req.params.domain }).exec()) || [];

		return res.json({ success: true, domain });
	});

	return router;
};
