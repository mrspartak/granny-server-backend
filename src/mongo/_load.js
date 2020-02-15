const mongoose = require('mongoose');

function LModel(options) {
	return new Promise(async (resolve, reject) => {
		let { __, config } = options;

		await mongoose.connect(config.MONGO, {
			useUnifiedTopology: true,
			useNewUrlParser: true,
			useCreateIndex: true,
			keepAliveInitialDelay: 300000,
		});

		const { User, userRoleDescription } = require(__.path('user', { __dirname: __dirname }))(options);
		const { Domain, domainSettingsDescription } = require(__.path('domain', { __dirname: __dirname }))(options);
		const { Image } = require(__.path('image', { __dirname: __dirname }))(options);

		let mongo = {
			User,
			Domain,
			Image,
			desc: {
				userRoleDescription,
			},
		};

		return resolve(mongo);
	});
}

module.exports = LModel;
