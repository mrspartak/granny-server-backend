const Router = require('express-promise-router');
const router = new Router();
const crypto = require('crypto');
const sharp = require('sharp');

module.exports = function(options) {
	let { config, mongo, minio, log, mdlwr, __, _v } = options;

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
		if (!req.files) {
			log.debug('/image/upload', 'No file');
			return res.json({ success: false, error: 'no_file_sent' });
		}

		if (!req.files.image) {
			log.debug('/image/upload', 'File obj name', Object.keys(req.files));
			return res.json({ success: false, error: 'file_name_must_be_image' });
		}

		let domain = req.domain.domain;
		if (!domain) {
			log.debug('/image/upload', 'No domain found');
			return res.json({ success: false, error: 'cant_find_hostname' });
		}

		let file = req.files.image;
		let body = req.body;

		body.path = __.sanitizePath(body.path);

		if (!body.path) {
			log.debug('/image/upload', 'No path provided');
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
				log.debug('/image/upload', 'Unsupported format', metadata.format);
				return res.json({ success: false, error: 'unsupported_format' });
			}

			width = metadata.width;
			height = metadata.height;

			let relativeFolderPath = [...hashedPath_splited].join('/');
			let fileName = `original.${metadata.format}`;
			let relativeFilePath = relativeFolderPath + '/' + fileName;

			var [err, etag] = await __.to(minio.putObject(domain, relativeFilePath, file.data));
			if (err) {
				log.debug('/image/upload', 'Error uploading to minio', err.message);
				return res.json({ success: false, error: 'error_uploading_image' });
			}

			var [err, stat] = await __.to(minio.statObject(domain, relativeFilePath))
			if (err) log.debug('/image/upload', 'Minio stat error', err.message);

			let toSave = {
				domain,
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
			};

			let img,
				imgDB,
				replaced = false;

			img = await mongo.Image.findOne({ domain: domain, path: body.path }).exec();
			if (!img) {
				imgDB = new mongo.Image(toSave);
			} else {
				imgDB = Object.assign(img, toSave);
				replaced = true;
			}

			img = await imgDB.save();

			let imageUrl = `//${domain}/i/${img.path}`;

			return res.json({
				success: true,
				imageUrl,
				imagePath: img.path,
				replaced,
			});
		} catch (error) {
			log.error('/upload', 'try/catch error', error);
			return res.json({ success: false, error: 'cant_compute_file' });
		}
	});

	router.post('/edit', async (req, res) => {});

	router.post('/delete', async (req, res) => {
		let body = req.body;
		if(!body.path) return res.json({ success: false, error: 'no_file' });

		let path = __.sanitizePath(body.path);

		let domain = req.domain.domain;
		if (!domain) {
			log.debug('/image/delete', 'No domain found');
			return res.json({ success: false, error: 'cant_find_hostname' });
		}

		let image = await mongo.Image.findOne({ domain, path }).exec();
		if (!image) return res.json({ success: false, error: 'no_file' });
		if (image.deleted) return res.json({ success: false, error: 'no_file' });

		image.deleted = true
		await image.save()

		return res.json({ success: true });
	})

	router.get('/info', async (req, res) => {
		let body = req.query;
		if(!body.path) return res.json({ success: false, error: 'no_file' });

		let path = __.sanitizePath(body.path);

		let domain = req.domain.domain;
		if (!domain) {
			log.debug('/image/info', 'No domain found');
			return res.json({ success: false, error: 'cant_find_hostname' });
		}

		let image = await mongo.Image.findOne({ domain, path }).select('-s3_folder -reference.s3_file -refChildren.s3_file').exec();
		if (!image) return res.json({ success: false, error: 'no_file' });
		if (image.deleted) return res.json({ success: false, error: 'no_file' });

		return res.json({ success: true, image });
	});

	return router;
};
