const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Types = Schema.Types;
const Model = mongoose.model;

const autoref = require('mongoose-autorefs');

function LModel(options) {
	let modelSchema = new Schema(
		{
			user: { type: Types.ObjectId, ref: 'User' },
			domain: String,

			settings: Object,

			accessKey: String,
			accessSecret: String,
		},
		{
			timestamps: true,
		},
	);
	modelSchema.plugin(autoref, ['user.domains']);

	modelSchema.index(
		{
			domain: 1,
		},
		{
			unique: true,
		},
	);

	let Domain = Model('Domain', modelSchema);

	Domain.domainExists = async function(domain) {
		return !!(await this.findOne({ domain: domain }).exec());
	};

	return { Domain };
}

module.exports = LModel;
