const winston = require('winston');
const ApexLogsTransport = require('apex-logs-winston')

function init({ config }) {
	let level = 'info';
	if (config.ENV == 'development') level = 'debug';

	const logger = winston.createLogger({
		level,
		format: winston.format.combine(
			winston.format.timestamp({
				format: 'DD.MM.YY HH:mm:ss',
			}),
			winston.format.json(),
		),
		defaultMeta: config.DEFAULT_META
	});

	logger.add(
		new winston.transports.Console({
			format: winston.format.combine(winston.format.simple()),
		}),
	);

	if (config.ENV == 'production' && config.APEX_LOGS_URL) {
		logger.add(
			new ApexLogsTransport({
				url: config.APEX_LOGS_URL,
				authToken: config.APEX_LOGS_AUTH_TOKEN,
				projectId: config.APEX_LOGS_PROJECT_ID
			})
		);
	}
	
	return logger;
}

module.exports = init;
