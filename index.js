const redriver = require('./build/sqs-redriver');

exports.handler = function(sns_event) {
  console.log('Starting queue redrive...');

  redriver.default.redriveMessages({ sns_event: sns_event })
      .then(() => {
        console.log('Queue redrive complete');
      })
      .catch(err => {
        console.log('Queue redrive failed', err);
      });
};

