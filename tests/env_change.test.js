/*const request = require('supertest')

process.env.API_KEY = 'test'
const app = require('../src/server')


describe('Access test. API_KEY setted up', () => {
	it('should return access denied', async (done) => {
		let res = await request(app)
			.post('/upload')
			.set('Accept', 'application/json')

		expect(res.type).toEqual('application/json')
		expect(res.status).toEqual(403)
		expect(res.body.success).toEqual(false)
		expect(res.body.error).toEqual('Access denied')

		done();
	})
})*/