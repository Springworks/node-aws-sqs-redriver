import { validateSchema, joi } from '@springworks/input-validator';
import sqs_instance from './sqs-instance';

const deserialized_queue_params_schema = joi.object().required().keys({
  source_queue_url: joi.string().uri().required(),
  target_queue_url: joi.string().uri().required(),
});

const params_schema = joi.object().required().keys({
  sns_event: joi.object().required().keys({
    Records: joi.array().required().items(joi.object().required().keys({
      EventVersion: joi.string().optional(),
      EventSubscriptionArn: joi.string().optional(),
      EventSource: joi.string().optional(),
      Sns: joi.object().required().keys({
        SignatureVersion: joi.string().optional(),
        Timestamp: joi.string().optional(),
        Signature: joi.string().optional(),
        SigningCertUrl: joi.string().optional(),
        MessageId: joi.string().optional(),
        Message: joi.string().required().notes('Expected to be stringified JSON, see deserialized_queue_params_schema'),
        MessageAttributes: joi.object().optional(),
        Type: joi.string().optional(),
        UnsubscribeUrl: joi.string().optional(),
        TopicArn: joi.string().optional(),
        Subject: joi.string().optional().allow(''),
      }),
    })),
  }),
});

function validateParams(params) {
  return validateSchema(params, params_schema);
}

function extractQueueUrls(validated_params) {
  const queue_params = JSON.parse(validated_params.sns_event.Records[0].Sns.Message);
  return validateSchema(queue_params, deserialized_queue_params_schema);
}

function fetchMessagesUntilEmpty({ source_queue_url, target_queue_url }) {
  return receiveMessage({ source_queue_url })
      .then(sqs_message => {
        if (!sqs_message) {
          return null;
        }
        return redriveMessage({ sqs_message, source_queue_url, target_queue_url })
            .then(() => fetchMessagesUntilEmpty({ source_queue_url, target_queue_url }));
      });
}

function redriveMessage({ sqs_message, source_queue_url, target_queue_url }) {
  console.log('Redriving message with receipt handle %s...', sqs_message.ReceiptHandle);
  return sendMessage({ message_body: sqs_message.Body, target_queue_url })
      .then(() => deleteMessage({ receipt_handle: sqs_message.ReceiptHandle, source_queue_url }))
      .then(() => console.log(`Message moved from ${source_queue_url} to ${target_queue_url}`))
      .then(() => null);
}

function receiveMessage({ source_queue_url }) {
  return new Promise((resolve, reject) => {
    sqs_instance.receiveMessage({
      MaxNumberOfMessages: 1,
      QueueUrl: source_queue_url,
      WaitTimeSeconds: 20,
    }, (err, messages) => {
      if (err) {
        reject(err);
        return;
      }

      if (messages.length) {
        resolve(messages[0]);
        return;
      }

      console.log('No more messages received in queue...');
      resolve(null);
    });
  });
}


function deleteMessage({ source_queue_url, receipt_handle }) {
  return new Promise((resolve, reject) => {
    sqs_instance.deleteMessage({
      ReceiptHandle: receipt_handle,
      QueueUrl: source_queue_url,
    }, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
}


function sendMessage({ target_queue_url, message_body }) {
  return new Promise((resolve, reject) => {
    sqs_instance.sendMessage({
      QueueUrl: target_queue_url,
      MessageBody: message_body,
    }, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
}

const api = {
  redriveMessages({ sns_event }) {
    return Promise.resolve({ sns_event })
        .then(validateParams)
        .then(extractQueueUrls)
        .then(fetchMessagesUntilEmpty)
        .catch(err => {
          console.warn('redriveMessages failed: %s', err);
          throw err;
        });
  },
};

export default api;
