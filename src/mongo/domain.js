const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Types = Schema.Types;
const Model = mongoose.model;

const autoref = require('mongoose-autorefs');
const uniqueValidator = require('mongoose-unique-validator');

function LModel(options) {
	let modelSchema = new Schema(
		{
			user: { type: Types.ObjectId, ref: 'User' },
			domain: { type: String, index: true, unique: true, required: true},

			settings: Object,

			accessKey: { type: String, index: true },
			accessSecret: String,
		},
		{
			timestamps: true,
		},
	);
	modelSchema.plugin(autoref, ['user.domains']);
	modelSchema.plugin(uniqueValidator);

	let Domain = Model('Domain', modelSchema);

	Domain.domainExists = async function(domain) {
		return !!(await this.findOne({ domain: domain }).exec());
	};

	return { Domain };
}

module.exports = LModel;
