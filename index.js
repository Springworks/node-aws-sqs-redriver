exports.handler = function(sns_event, context, callback) {
  process.env.PATH = `${process.env.PATH}:${process.env.LAMBDA_TASK_ROOT}`;

  if (context && context.functionName === 'ReDriveQueueMessages') {
    context.callbackWaitsForEmptyEventLoop = false;
  }
  const logger = require('./build/logger').default;
  const redriver = require('./build/sqs-redriver').default;
  logger.info('Starting queue redrive...');

  redriver.redriveMessages({ sns_event: sns_event })
      .then(() => {
        logger.info('Queue redrive complete');
        setImmediate(() => callback());
      })
      .catch(err => {
        logger.trace('Queue redrive failed', err);
        setImmediate(() => callback(err));
      });
};

