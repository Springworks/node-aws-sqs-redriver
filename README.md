# AWS SQS Redriver
Re-drives messages from one SQS queue to another, e.g. to re-process "dead letters".

Meant to be triggered by an SNS notification and run on a Lambda.

## Message Redriver API

### `redriveMessages({ sns_event }) -> Promise`

Moves messages from `source_queue_url` to `target_queue_url`, which should be defined as stringified JSON in the event `Message`.

*NOTE*: When added to `target_queue_url`, the message will only include the `MessageBody` property, not any `MessageAttributes` or other properties of the message in the source queue.

#### Example

```js
const redriver = require('./build/sqs-redriver');
const dead_letter_queue_url = 'arn:aws:sqs:region:account-id:queuename_dlq';
const target_queue_url = 'arn:aws:sqs:region:account-id:queuename';

const queue_params = {
  source_queue_url: 'https://queue.amazonaws.com/80398EXAMPLE/MyDLQ',
  target_queue_url: 'https://queue.amazonaws.com/80398EXAMPLE/MyQueue',
};

// SNS Event should have Message: JSON.stringify(queue_params)

redriver.redriveMessages({ sns_event: sns_event })
      .then(() => console.log('Success!'))
      .catch(err => console.log('Failed to redrive messages: %j', err));
```

#### IAM access to queues

`source_queue_url`

- sqs:ChangeMessageVisibility
- sqs:ReceiveMessage
- sqs:DeleteMessage

`target_queue_url`

- sqs:SendMessage

## License

MIT.
