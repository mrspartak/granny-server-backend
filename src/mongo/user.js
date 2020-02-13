const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Types = Schema.Types;
const Model = mongoose.model;

const autoref = require('mongoose-autorefs');

function LModel(options) {
	const userRoleDescription = {
		roles: {
			admin: 'Admin',
			client: 'Client',
		},
	};

	let modelSchema = new Schema(
		{
			login: String,
			password: String,
			token: String,
			role: {
				type: String,
				enum: Object.keys(userRoleDescription.roles),
				required: true,
			},
			domains: [{ type: Types.ObjectId, ref: 'Domain' }],
		},
		{
			timestamps: true,
		},
	);
	modelSchema.plugin(autoref, ['domains.user']);

	let User = Model('User', modelSchema);

	User.adminExists = async function() {
		let result = await this.find({ role: 'admin' }).exec();
		return result.length ? true : false;
	};
	User.checkRequestToken = async function(req) {
		let token = req.headers.authorization || false;
		if (!token) throw new Error('login_required');

		let user = await this.findOne({ token: token }).exec();
		if (!user) throw new Error('login_required');

		return user;
	};

	return { User, userRoleDescription };
}

module.exports = LModel;
