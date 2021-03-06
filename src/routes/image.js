const Router = require('express-promise-router');
const router = new Router();
const crypto = require('crypto');
const sharp = require('sharp');

module.exports = function(options, { log }) {
	let { mongo, getMinio, mdlwr, __ } = options;

	router.use(mdlwr.MUST_BE_INITIATED);
	router.use(mdlwr.ACCESS_KEY_SECRET);

	const SUPPORTED_FORMATS = ['jpeg', 'png', 'webp', 'gif'];

	/* routes */

	/**
	 * @api {post} /image/upload Upload original image
	 * @apiName UploadImage
	 * @apiGroup Image
	 *
	 * @apiParam {String} path Path of image with name.
	 *
	 * @apiSuccess {String} firstname Firstname of the User.
	 */
	router.post('/upload', async (req, res) => {
		let tsStart = __.benchStart()
		const logger = log.child({ path: req.path });
		
		if (!req.files) {
			logger.warn({ breakpoint: 'files.check.exist', message: 'No file', duration: tsStart() });
			return res.json({ success: false, error: 'no_file_sent' });
		}

		if (!req.files.image) {
			logger.warn({ breakpoint: 'files.check.key', message: 'File obj name', keys: Object.keys(req.files), duration: tsStart()  });
			return res.json({ success: false, error: 'file_name_must_be_image' });
		}

		let domain = req.domain;
		let domainName = domain.domain


		if (!domain) {
			logger.warn({ breakpoint: 'domain.check', message: 'No domain found', duration: tsStart()  });
			return res.json({ success: false, error: 'cant_find_hostname' });
		}

		if(domain.adminSettings.maxSize > 0 && domain.adminSettings.maxSize < domain.size) {
			logger.warn({ breakpoint: 'domain.size', message: 'Domain disk space has run out', size: domain.size, maxSize: domain.adminSettings.maxSize, duration: tsStart()  });
			return res.json({ success: false, error: 'no_disk_space_for_domain_left' });
		}

		let file = req.files.image;
		let body = req.body;

		body.path = __.sanitizePath(body.path);

		if (!body.path) {
			logger.warn({ breakpoint: 'path.check', message: 'No path provided', duration: tsStart()  });
			return res.json({ success: false, error: 'file_path_must_be_provided' });
		}		

		let width, height;

		let hashedPath = crypto
			.createHash('sha256')
			.update(body.path)
			.digest('hex');
		let hashedPath_splited = hashedPath.match(/.{1,12}/g);

		try {
			let image = sharp(file.data, {
				failOnError: true,
			});

			let metadata = await image.metadata();
			if (SUPPORTED_FORMATS.indexOf(metadata.format) == -1) {
				logger.warn({ breakpoint: 'format.check', message: `Unsupported format ${metadata.format}`, format: metadata.format, duration: tsStart() });
				return res.json({ success: false, error: 'unsupported_format' });
			}

			width = metadata.width;
			height = metadata.height;

			let relativeFolderPath = [...hashedPath_splited].join('/');
			let fileName = `original.${metadata.format}`;
			let relativeFilePath = relativeFolderPath + '/' + fileName;

			let minio = getMinio(domain.s3)


			var [err, etag] = await __.to(minio.putObject(domain.s3.bucket, relativeFilePath, file.data));
			if (err) {
				logger.error({ breakpoint: 'minio.putObject', message: err.message, duration: tsStart() });
				return res.json({ success: false, error: 'error_uploading_image' });
			}

			var [err, stat] = await __.to(minio.statObject(domain.s3.bucket, relativeFilePath))
			if (err) {
				logger.warn({ breakpoint: 'minio.statObject', message: err.message, duration: tsStart() });
			}

			let toSave = {
				domain: domainName,
				format: metadata.format,

				path: body.path,
				path_array: body.path.split('/'),
				s3_folder: relativeFolderPath,

				original: {
					s3_file: fileName,
					etag,
					size: stat.size ? stat.size : 0,
					width,
					height,
				},

				reference: {},
				deleted: false
			};

			let img,
				imgDB,
				replaced = false;

			img = await mongo.Image.findOne({ domain: domainName, path: body.path }).exec();
			if (!img) {
				imgDB = new mongo.Image(toSave);
			} else {
				imgDB = Object.assign(img, toSave);
				replaced = true;
			}

			img = await imgDB.save();

			let imageUrl = `//${domainName}/i/${img.path}`;

			logger.info({ message: `image uploaded`, duration: tsStart(), domain: domainName, path: img.path });

			return res.json({
				success: true,
				imageUrl,
				imagePath: img.path,
				replaced,
			});
		} catch (error) {
			logger.error({ breakpoint: 'catch', message: error.message, duration: tsStart() });
			return res.json({ success: false, error: 'cant_compute_file' });
		}
	});

	router.post('/edit', async (req, res) => {});

	router.post('/delete', async (req, res) => {
		let tsStart = __.benchStart()
		const logger = log.child({ path: req.path });

		let body = req.body;
		if(!body.path) return res.json({ success: false, error: 'no_file' });

		let path = __.sanitizePath(body.path);

		let domain = req.domain.domain;
		if (!domain) {
			logger.warn({ breakpoint: 'domain.check', message: 'No domain found', duration: tsStart()  });
			return res.json({ success: false, error: 'cant_find_hostname' });
		}

		let image = await mongo.Image.findOne({ domain, path }).exec();
		if (!image) return res.json({ success: false, error: 'no_file' });
		if (image.deleted) return res.json({ success: false, error: 'no_file' });

		logger.info({ message: `image deleted`, duration: tsStart(), domain: req.domain.domain, path });

		image.deleted = true
		await image.save()

		return res.json({ success: true });
	})

	router.get('/info', async (req, res) => {
		let tsStart = __.benchStart()
		const logger = log.child({ path: req.path });

		let body = req.query;
		if(!body.path) return res.json({ success: false, error: 'no_file' });

		let path = __.sanitizePath(body.path);

		let domain = req.domain.domain;
		if (!domain) {
			logger.warn({ breakpoint: 'domain.check', message: 'No domain found', duration: tsStart()  });
			return res.json({ success: false, error: 'cant_find_hostname' });
		}

		let image = await mongo.Image.findOne({ domain, path }).select('-s3_folder -reference.s3_file -refChildren.s3_file').exec();
		if (!image) return res.json({ success: false, error: 'no_file' });
		if (image.deleted) return res.json({ success: false, error: 'no_file' });

		return res.json({ success: true, image });
	});

	return router;
};
