const Router = require('express-promise-router')
const router = new Router()
const stream = require('stream')
const objHash = require('object-hash');
const sharp = require('sharp')

module.exports = function(options) {
	let {config, mongo, minio, __, _, log} = options

	
/* routes */
	router.get('/_status', async (req, res) => {
		config.APP_INITIATED = await mongo.User.adminExists()
		var [err, user] = await __.to( mongo.User.checkRequestToken(req) )
		
		res.json({
			success: true,
			auth: user ? true : false,
			id: config.ID,
			APP_INITIATED: config.APP_INITIATED
		})
	})

	/*
		modifiers: 
			divider - /_/, ex cdn.example.com/i/path/to/file.jpg/_/100x100
	*/
	router.get('/i/:path([a-zA-Z0-9_\\-/\.]+)', async (req, res) => {
		if(!req.params || !req.params.path) return res.json({success: false, error: 'request_is_incorrect'})

		let domain = await mongo.Domain.findOne({domain: req.hostname}).exec()
		if(!domain) {
			log.debug('/i/', 'Not found domain', req.hostname)
			return res.json({success: false, error: 'request_is_incorrect'})
		}

		let [path, modifications] = req.params.path.split('/_/')
		if(!path) return res.json({success: false, error: 'no_file'})

		path = __.sanitizePath(path)

		let modifiers = {}
		if(modifications) {
			modifications = modifications.split('/')

			let resizeRegex = /^(\d+)x(\d+)$/gi
			let progressiveRegex = /^pr$/gi
			let qualityRegex = /^q(\d+)$/gi
			let formatRegex = /^(jpg|png|webp|tiff)$/gi
			let bwRegex = /^(bw)$/gi

			modifications.forEach((modification) => {
				modification = __.sanitizePath(modification)

				let isResize = resizeRegex.exec(modification)
				if(isResize) modifiers.resize = {
					width: +isResize[1],
					height: +isResize[2]
				}

				let isProgressive = progressiveRegex.exec(modification) 
				if(isProgressive) modifiers.progressive = 1

				let isQuality = qualityRegex.exec(modification) 
				if(isQuality) modifiers.quality = +isQuality[1]

				let isFormat = formatRegex.exec(modification)
				if(isFormat) modifiers.format = isFormat[1]

				let isBw = bwRegex.exec(modification)
				if(isBw) modifiers.bw = true
			})

			log.debug('/i/', 'Got modifiers', modifiers)
		}

		let img = await mongo.Image.findOne({domain: domain.domain, path: path}).exec()
		if(!img) return res.json({success: false, error: 'no_file'})

		let refImage = img.reference && img.reference.path ? img.reference : img.original

		if(_.isEmpty(modifiers)) return sendImage(res, img, refImage)

		let modImageModifiers = Object.assign({}, refImage.modifications, modifiers)
		let modSign = objHash.MD5(modImageModifiers)

		let refChildren = img.refChildren.find(el => {return el.hash == modSign})
		if(refChildren) {
			log.debug('/i/', 'Serving already modified image', modSign)
			return sendImage(res, img, refChildren)
		}

		try {
			log.debug('/i/', 'Modified image not found. Computing')

			let readableStream = await minio.getObject(img.domain, `${img.s3_folder}/${refImage.s3_file}`)
			let writableStream = new stream.PassThrough()

			let format = modifiers.format ? modifiers.format : (refImage.format ? refImage.format : img.format)

			let pipeline = sharp()
			if(modifiers.resize) pipeline.resize(modifiers.resize.width, modifiers.resize.height)
			if(modifiers.progressive) {
				if(img.format == 'jpeg') pipeline.jpeg({progressive: true})
				if(img.format == 'png') pipeline.png({progressive: true})	
			}
			if(modifiers.quality) {
				if(img.format == 'jpeg') pipeline.jpeg({quality: modifiers.quality})
				if(img.format == 'png') pipeline.png({quality: modifiers.quality})
				if(img.format == 'webp') pipeline.webp({quality: modifiers.quality})
				if(img.format == 'tiff') pipeline.tiff({quality: modifiers.quality})
			}
			if(modifiers.format) {
				pipeline.toFormat(modifiers.format)
			}
			if(modifiers.bw) {
				pipeline.modulate({
					saturation: 0
				})
			}

			readableStream.pipe(pipeline).pipe(writableStream) 

			let fileName = `m_${modSign}.${img.format}`
			let relativeFilePath = img.s3_folder +'/'+ fileName
			let etag = await minio.putObject(img.domain, relativeFilePath, writableStream)

			if(!img.refChildren) img.refChildren = {}
			refChildren = {
				s3_file: fileName,
				format,
				etag,
				hash: modSign,
				width: modifiers.resize ? modifiers.resize.width : refImage.width,
				height: modifiers.resize ? modifiers.resize.height : refImage.height,
				modifications: modImageModifiers
			}
			img.refChildren.push(refChildren)

			img = await img.save()

			return sendImage(res, img, refChildren)

		} catch(err) {
			log.error('/i/', 'Sharp error', err.message)
			return res.json({success: false, error: 'error_modifying'}) 
		}
	})

	async function sendImage(res, image, refImage) {
		let format = refImage.format ? refImage.format : image.format
		res.set({
			'Content-Type': `image/${format}`,
			'ETag': refImage.etag
		})

		;(await minio.getObject(image.domain, `${image.s3_folder}/${refImage.s3_file}`)).pipe(res)
	}

	return router
}