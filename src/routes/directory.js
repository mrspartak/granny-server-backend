const Router = require('express-promise-router');
const router = new Router();

module.exports = function(options) {
	let { mongo, mdlwr, __ } = options;

	router.use(mdlwr.MUST_BE_INITIATED);
	router.use(mdlwr.ACCESS_KEY_SECRET);

	/* routes */
	/*
		get entries at dir path
	*/
	router.get('/list', async (req, res) => {
		let query = req.query;

		let path = query && query.path ? query.path : '';
		path = __.sanitizePath(path);
		let path_array = path ? path.split('/') : [];

		let findQuery = { domain: req.domain.domain, deleted: {$ne: true} };
		if (path) findQuery.path = { $regex: new RegExp('^' + path + '/', 'ig') };
		let groupQuery = {
			_id: { $arrayElemAt: ['$path_array', path_array.length] },
			files: { $sum: 1 },
			pathIsFile: {
				$sum: {
					$ifNull: [
						{
							$arrayElemAt: ['$path_array', path_array.length + 1],
						},
						1,
					],
				},
			},
			originalSize: {
				$sum: "$original.size"
			},
			refSize: {
				$sum: "$reference.size"
			},
			refChildrenSize: {
				$sum: {$sum: "$refChildren.size"}
			}
		};

		let result = await mongo.Image.aggregate([
			{
				$match: findQuery,
			},
			{
				$group: groupQuery,
			},
		]).exec();

		let structure = [];
		result.forEach(pathElement => {
			if (pathElement.pathIsFile)
				structure.push({
					path: pathElement._id,
					size: {
						original: pathElement.originalSize,
						ref: pathElement.refSize,
						refChildren: pathElement.refChildrenSize
					},
					type: 'file',
				});
			if (pathElement.files > pathElement.pathIsFile)
				structure.push({
					path: pathElement._id,
					type: 'folder',
					size: {
						original: pathElement.originalSize,
						ref: pathElement.refSize,
						refChildren: pathElement.refChildrenSize
					},
					items: pathElement.files - pathElement.pathIsFile,
				});
		});

		return res.json({
			success: true,
			path: '/' + path,
			structure,
		});
	});

	return router;
};
