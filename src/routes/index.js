const Router = require('express-promise-router');
const router = new Router();
const stream = require('stream');
const objHash = require('object-hash');
const sharp = require('sharp');

module.exports = function(options) {
	let { config, mongo, getMinio, __, _, log } = options;

	/* routes */
	router.get('/_status', async (req, res) => {
		config.APP_INITIATED = await mongo.User.adminExists();
		var [err, user] = await __.to(mongo.User.checkRequestToken(req));

		res.json({
			success: true,
			auth: user ? true : false,
			role: user ? user.role : false,
			id: config.ID,
			APP_INITIATED: config.APP_INITIATED,
			ts: parseInt(new Date().getTime()/1000)
		});
	});

	router.get('/_me', async (req, res) => {
		config.APP_INITIATED = await mongo.User.adminExists();
		var [err, user] = await __.to(mongo.User.checkRequestToken(req));

		res.json({
			success: true,
			user: user ? user : {}
		});
	});

	/*
		original image uploaded by path /user/sergio.jpg is avialable at path cdn.example.com/i/user/sergio.jpg
		modifiers: 
			use divider - /_/, ex cdn.example.com/i/width=100,height=100,format=webp/_/user/sergio.jpg
			
			Resize image will be in cover mode. You can provide only one dimension
			- width || w: Number
			- height || h: Number
			- resize || r: String (100x100 || 100)
			
			Progressive image. Supported by jpeg, png
			- progressive || pr: No value

			Quality. Supported by jpeg, png, webp
			- quality || q: Number [1-100]

			Format
			- format || f: String [jpg|jpeg|png|webp]

			Black and white
			- bw: No value
			
			Blur. Gaussian if number provided
			- blur: No value or Number [1-1000]
	*/
	router.get(/^\/i\/(.*)$/, async (req, res) => {
		if (!req.params || !req.params[0]) return res.json({ success: false, error: 'request_is_incorrect' });

		let domain = await mongo.Domain.findOne({ domain: req.hostname }).exec();
		if (!domain) {
			log.debug('/i/', 'Not found domain', req.hostname);
			return res.json({ success: false, error: 'request_is_incorrect' });
		}
		if (domain.deleted) return res.json({ success: false, error: 'domain_deleted' });
		
		let minio = getMinio(domain.s3)

		//check referer
		let referer = req.headers.referrer || req.headers.referer
		let refererPass = domain.settings.referer.some((refCheck) => {
			if(refCheck == '*') return true;
			if(refCheck == '__allow_direct__' && typeof referer == 'undefined') return true;

			let regex = new RegExp( RegExp.escape(refCheck) )
			return !!regex.exec(referer)
		})

		if(!refererPass) {
			log.debug('/i/', '!RefererPass', referer, domain.settings.referer);
			return res.json({ success: false, error: 'not_allowed_request' });
		}

		let [modifications, path] = req.params[0].split('/_/');
		if (!modifications) return res.json({ success: false, error: 'no_file_path' });

		if (!path) {
			path = modifications;
			modifications = '';
		}

		path = __.sanitizePath(path);

		let modifiers = {};
		if (modifications) {
			modifications = modifications.split(',');

			modifications.forEach(modification => {
				modification = __.sanitizePath(modification);
				let [modKey, modValue] = modification.split('=');

				if ((modKey == 'width' || modKey == 'w') && modValue) {
					modValue = parseInt(modValue);
					if (!isNaN(modValue)) {
						if (!modifiers.resize) modifiers.resize = {};
						modifiers.resize.width = modValue;
					}
				}
				if ((modKey == 'height' || modKey == 'h') && modValue) {
					modValue = parseInt(modValue);
					if (!isNaN(modValue)) {
						if (!modifiers.resize) modifiers.resize = {};
						modifiers.resize.height = modValue;
					}
				}
				if ((modKey == 'resize' || modKey == 'r') && modValue) {
					let [rWidth, rHeight] = modValue.split('x');
					if (!rHeight) rHeight = rWidth;
					rHeight = parseInt(rHeight);
					rWidth = parseInt(rWidth);
					if (!isNaN(rHeight) && !isNaN(rWidth)) {
						if (!modifiers.resize) modifiers.resize = {};

						if (rWidth) modifiers.resize.width = rWidth;
						if (rHeight) modifiers.resize.height = rHeight;
					}
				}

				if (modKey == 'prpgressive' || modKey == 'pr') modifiers.progressive = 1;

				if ((modKey == 'quality' || modKey == 'q') && modValue) {
					modValue = parseInt(modValue);
					if (modValue >= 1 && modValue <= 100) modifiers.quality = modValue;
				}

				//if (formatModifier) modifiers.format = formatModifier;
				if ((modKey == 'format' || modKey == 'f') && modValue) {
					modValue = normalizeFormat(modValue);
					if (modValue) modifiers.format = modValue;
				}

				if (modKey == 'bw') modifiers.bw = true;

				if (modKey == 'blur') {
					modValue = modValue ? parseInt(modValue) : true;
					if (modValue < 1 || modValue > 1000) modValue = true;
					modifiers.blur = modValue;
				}
			});

			log.debug('/i/', 'Got modifiers', modifiers);
		}

		let img = await mongo.Image.findOne({ domain: domain.domain, path: path }).exec();
		if (!img) return res.json({ success: false, error: 'no_file_found' });
		if (img.deleted) return res.json({ success: false, error: 'image_deleted' });

		let refImage = img.reference && img.reference.path ? img.reference : img.original;

		if (_.isEmpty(modifiers)) return sendImage(res, img, refImage, domain.s3.bucket, minio);

		let modImageModifiers = Object.assign({}, refImage.modifications, modifiers);
		let modSign = objHash.MD5(modImageModifiers);

		let refChildren = img.refChildren.find(el => {
			return el.hash == modSign;
		});
		if (refChildren) {
			log.debug('/i/', 'Serving already modified image', modSign);
			return sendImage(res, img, refChildren, domain.s3.bucket, minio);
		}

		try {
			log.debug('/i/', 'Modified image not found. Computing');

			let readableStream = await minio.getObject(domain.s3.bucket, `${img.s3_folder}/${refImage.s3_file}`);
			let writableStream = new stream.PassThrough();

			let format = modifiers.format ? modifiers.format : refImage.format ? refImage.format : img.format;

			let pipeline = sharp();
			if (modifiers.resize) pipeline.resize(modifiers.resize.width, modifiers.resize.height);
			if (modifiers.progressive) {
				if (img.format == 'jpeg') pipeline.jpeg({ progressive: true });
				if (img.format == 'png') pipeline.png({ progressive: true });
			}
			if (modifiers.quality) {
				if (img.format == 'jpeg') pipeline.jpeg({ quality: modifiers.quality });
				if (img.format == 'png') pipeline.png({ quality: modifiers.quality });
				if (img.format == 'webp') pipeline.webp({ quality: modifiers.quality });
			}
			if (modifiers.format) {
				pipeline.toFormat(modifiers.format);
			}
			if (modifiers.bw) {
				pipeline.modulate({
					saturation: 0,
				});
			}
			if (modifiers.blur) {
				if (modifiers.blur === true) pipeline.blur();
				else pipeline.blur(modifiers.blur);
			}

			let ttl = domain.settings.ttl ? parseInt(new Date().getTime()/1000) + domain.settings.ttl * 3600 : 0

			//if do not save modified
			if(ttl == 0) {
				log.debug('/i/', 'Skip save. Pipe');
				res.set({
					'Content-Type': `image/${format}`
				});
				readableStream.pipe(pipeline).pipe(res);
			} else {
				log.debug('/i/', 'Saving image');

				readableStream.pipe(pipeline).pipe(writableStream);

				let fileName = `m_${modSign}.${img.format}`;
				let relativeFilePath = img.s3_folder + '/' + fileName;
				let etag = await minio.putObject(domain.s3.bucket, relativeFilePath, writableStream);

				var [err, stat] = await __.to(minio.statObject(domain.s3.bucket, relativeFilePath))
				if (err) log.debug('/i/', 'Minio stat error', err.message);

				if (!img.refChildren) img.refChildren = {};
				refChildren = {
					s3_file: fileName,
					format,
					size: stat.size ? stat.size : 0,
					etag,
					hash: modSign,
					width: modifiers.resize ? modifiers.resize.width : refImage.width,
					height: modifiers.resize ? modifiers.resize.height : refImage.height,
					modifications: modImageModifiers,
					ttl
				};
				img.refChildren.push(refChildren);

				img = await img.save();

				return sendImage(res, img, refChildren, domain.s3.bucket, minio);
			}
		} catch (err) {
			log.error('/i/', 'Sharp error', err.message);
			return res.json({ success: false, error: 'error_modifying' });
		}
	});

	async function sendImage(res, image, refImage, bucket, minio) {
		let format = refImage.format ? refImage.format : image.format;
		res.set({
			'Content-Type': `image/${format}`,
			ETag: refImage.etag,
		});
		(await minio.getObject(bucket, `${image.s3_folder}/${refImage.s3_file}`)).pipe(res);
	}

	function normalizeFormat(input) {
		let format = false;
		if (input == 'jpeg' || input == 'jpg') format = 'jpg';
		if (input == 'png') format = 'png';
		if (input == 'webp' || input == 'wbp') format = 'webp';

		return format;
	}

	return router;
};
