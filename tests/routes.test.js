;(async () => {
	const request = require('supertest')
	const { app } = await require('../src/server')()

	describe('GET /_status', () => {
		it('should get JSON with status info', (done) => {
			request(app)
				.get('/_status')
				.set('Accept', 'application/json')
				.expect('Content-Type', /json/)
				.expect(200, done)
		})
	})

	/*describe('POST /upload', () => {
		it('should return error, that no file uploaded', async (done) => {
			let res = await request(app)
				.post('/upload')
				.set('Accept', 'application/json')

			expect(res.type).toEqual('application/json')
			expect(res.body.success).toEqual(false)

			done();
		})

		it('should return error, that file is wrong name key', async (done) => {
			let res = await request(app)
				.post('/upload')
				.attach('wrong_key', './tests/fixtures/text.file')
				.set('Accept', 'application/json')

			expect(res.type).toEqual('application/json')
			expect(res.body.success).toEqual(false)
			expect(res.body.error).toEqual('File must be named image')

			done();
		})

		it('should return error, that bucket name is too long', async (done) => {
			let res = await request(app)
				.post('/upload')
				.type('form')
				.attach('image', './tests/fixtures/text.file')
				.field('bucket', 'ughpowefhoweifhwoeifhoweifhwoeifnwoeifnwoefnwouihrtpgoihrtopgirhtogioefnweof')
				.set('Accept', 'application/json')

			expect(res.type).toEqual('application/json')
			expect(res.body.success).toEqual(false)
			expect(res.body.error).toEqual('Bucket name must be less than 32 character')

			done();
		})

		it('should return sharp expeption, file is not an image', async (done) => {
			let res = await request(app)
				.post('/upload')
				.type('form')
				.attach('image', './tests/fixtures/text.file')
				.field('bucket', 'test')
				.set('Accept', 'application/json')

			expect(res.type).toEqual('application/json')
			expect(res.body.success).toEqual(false)
			expect(res.body.error).toEqual('Can\'t compute file')

			done();
		})

		it('should return error, that file type is not supported', async (done) => {
			let res = await request(app)
				.post('/upload')
				.type('form')
				.attach('image', './tests/fixtures/unsupported_image.svg')
				.field('bucket', 'test')
				.set('Accept', 'application/json')

			expect(res.type).toEqual('application/json')
			expect(res.body.success).toEqual(false)
			expect(res.body.error).toMatch(/Unsupported format/)

			done();
		})
	})*/
})()