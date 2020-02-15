function APP(options) {
	return new Promise(async (resolve, reject) => {
		const express = require('express');
		const app = express();
		const _ = require('lodash');
		const __ = require('../utils/utils');
		const _v = require(__.path('utils/validate'));
		require(__.path('utils/prototypes'));

		const moment = require('moment');
		moment.locale('ru');
		const sharp = require('sharp');
		const md5 = require('nano-md5');
		const fs = require('fs').promises;

		/* Config from env */
		const config = {
			APP_PORT: process.env.APP_PORT || 3000,
			DEBUG: process.env.DEBUG || false,
			MONGO: process.env.MONGO || 'mongodb://localhost/js_cdn',
			ID: (await __.uniqueIDv2(2)).toLocaleUpperCase(),
			APP_INITIATED: false,

			S3_HOST: process.env.S3_HOST || '127.0.0.1',
			S3_PORT: process.env.S3_PORT || 9000,
		};
		if (process.env.S3_ACCESS_KEY) config.S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
		else if (process.env.S3_ACCESS_KEY_FILE)
			config.S3_ACCESS_KEY = (await fs.readFile('/run/secrets/' + process.env.S3_ACCESS_KEY_FILE)).toString();
		else config.S3_ACCESS_KEY = 'minioadmin';

		if (process.env.S3_ACCESS_SECRET) config.S3_ACCESS_SECRET = process.env.S3_ACCESS_SECRET;
		else if (process.env.S3_ACCESS_SECRET_FILE)
			config.S3_ACCESS_SECRET = (
				await fs.readFile('/run/secrets/' + process.env.S3_ACCESS_SECRET_FILE)
			).toString();
		else config.S3_ACCESS_SECRET = 'minioadmin';

		/* Logger */
		const log = require(__.path('utils/log'))({
			prefix: '#' + config.ID + ' |',
			level: config.DEBUG ? 'debug' : 'info',
		});
		log.info('START CONST', config);

		/* Initial modules pool */
		const initModules = { __, _v, _, log, moment, sharp, md5, config };

		/* Minio server */
		const Minio = require('minio');

		const minio = new Minio.Client({
			endPoint: config.S3_HOST,
			port: config.S3_PORT,
			useSSL: false,
			accessKey: config.S3_ACCESS_KEY,
			secretKey: config.S3_ACCESS_SECRET,
		});

		/* Mongo */
		const mongo = await require(__.path('src/mongo/_load'))(initModules);
		_.assign(initModules, { mongo, minio });

		/* Middleware */
		const bodyParser = require('body-parser');
		const cors = require('cors');
		const helmet = require('helmet');
		const fileUpload = require('express-fileupload');

		app.use(bodyParser.json())
			.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }))
			.use(cors())
			.use(fileUpload())
			.use(helmet());

		app.use((req, res, next) => {
			log.debug(req.method + ' | ' + req.path);
			next();
		});

		/* Whole modules pool */
		_.assign(initModules, { app });

		/* Not found and error processing */
		/*app.use((req, res) => {
			res.status(404)
			return res.json({
				success: false,
				error: 'Page not found'
			})
		})




		app.use((err, req, res, next) => {
		    res.status(500)
		    res.json({success: false, error: 'Server error'})
		})*/

		/* Assing modules */
		await require(__.path('src/routes/_load'))(initModules);

		return resolve(initModules);
	});
}

module.exports = APP;
