const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Types = Schema.Types;
const Model = mongoose.model;

const autoref = require('mongoose-autorefs');
const uniqueValidator = require('mongoose-unique-validator');

function LModel(options) {
	const userRoleDescription = {
		roles: {
			admin: 'Admin',
			client: 'Client',
		},
	};

	let modelSchema = new Schema(
		{
			login: { type: String, index: true, unique: true, required: true },
			password: String,
			token: { type: String, index: true },
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
	modelSchema.plugin(autoref, ['domains.users']);
	modelSchema.plugin(uniqueValidator);

	let User = Model('User', modelSchema);

	User.adminExists = async function() {
		let result = await this.find({ role: 'admin' }).exec();
		return result.length ? true : false;
	};
	User.userExists = async function(login) {
		return !!(await this.findOne({ login }).exec());
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
