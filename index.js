exports.handler = function(sns_event, context, callback) {
  process.env.PATH = `${process.env.PATH}:${process.env.LAMBDA_TASK_ROOT}`;

  if (context && context.functionName === 'ReDriveQueueMessages') {
    process.env.NODE_ENV = 'production';
    context.callbackWaitsForEmptyEventLoop = false;
  }
  const logger = require('./build/logger');
  const redriver = require('./build/sqs-redriver');
  logger.info('Starting queue redrive...');

  redriver.default.redriveMessages({ sns_event: sns_event })
      .then(() => {
        logger.info('Queue redrive complete');
        callback();
      })
      .catch(err => {
        logger.trace('Queue redrive failed', err);
        callback(err);
      });
};

