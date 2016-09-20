import autorestoredSandbox from '@springworks/test-harness/autorestored-sandbox';
import cloneDeep from 'lodash.clonedeep';
import redriver from '../../src/sqs-redriver';
import sqs_instance from '../../src/sqs-instance';
const sns_event_fixture = require('../../test-util/fixtures/sns-event.json');

const test_queue_params = {
  source_queue_url: 'https://queue.amazonaws.com/80398EXAMPLE/MyDLQ',
  target_queue_url: 'https://queue.amazonaws.com/80398EXAMPLE/MyQueue',
};

describe('test/unit/sqs-redriver-test.js', () => {
  const sinon_sandbox = autorestoredSandbox();

  describe('redriveMessages', () => {

    describe('with valid params', () => {
      let params;

      beforeEach(() => {
        params = createValidParams();
      });

      describe('with source queue having 2 messages', () => {
        let receive_message_stub;
        let send_message_stub;
        let delete_message_stub;
        let first_message;
        let second_message;

        beforeEach('createAwsStubs', () => {
          receive_message_stub = sinon_sandbox.stub(sqs_instance, 'receiveMessage');
          send_message_stub = sinon_sandbox.stub(sqs_instance, 'sendMessage');
          delete_message_stub = sinon_sandbox.stub(sqs_instance, 'deleteMessage');
        });

        describe('when calls to SQS succeed', () => {

          beforeEach('mockReceiveTwoMessages', () => {
            first_message = mockIncompleteButSufficientSqsMessage('first');
            second_message = mockIncompleteButSufficientSqsMessage('second');
            receive_message_stub.onCall(0).yieldsAsync(null, [first_message]);
            receive_message_stub.onCall(1).yieldsAsync(null, [second_message]);
            receive_message_stub.onCall(2).yieldsAsync(null, []);
          });

          beforeEach('mockSendMessage', () => {
            const irrelevant_data = {};
            send_message_stub.yieldsAsync(null, irrelevant_data);
          });

          beforeEach('mockDeleteMessage', () => {
            const irrelevant_data = {};
            delete_message_stub.yieldsAsync(null, irrelevant_data);
          });

          it('should resolve without value', () => {
            return redriver.redriveMessages(params).should.be.fulfilledWith(null);
          });

          it('should fetch 1 message at a time from source queue and iterate 3 times (resolve when not getting any message)', () => {
            return redriver.redriveMessages(params).then(() => {
              receive_message_stub.should.have.callCount(3);

              receive_message_stub.getCalls().forEach(call => {
                call.args[0].should.eql({
                  MaxNumberOfMessages: 1,
                  QueueUrl: test_queue_params.source_queue_url,
                });
              });
            });
          });

          it('should send all messages to target queue', () => {
            return redriver.redriveMessages(params).then(() => {
              send_message_stub.should.have.callCount(2);

              send_message_stub.firstCall.args[0].should.eql({
                MessageBody: first_message.Body,
                QueueUrl: test_queue_params.target_queue_url,
              });

              send_message_stub.secondCall.args[0].should.eql({
                MessageBody: second_message.Body,
                QueueUrl: test_queue_params.target_queue_url,
              });
            });
          });

          it('should delete each message from source queue', () => {
            return redriver.redriveMessages(params).then(() => {
              delete_message_stub.should.have.callCount(2);

              delete_message_stub.firstCall.args[0].should.eql({
                ReceiptHandle: first_message.ReceiptHandle,
                QueueUrl: test_queue_params.source_queue_url,
              });

              delete_message_stub.secondCall.args[0].should.eql({
                ReceiptHandle: second_message.ReceiptHandle,
                QueueUrl: test_queue_params.source_queue_url,
              });
            });
          });

        });

        describe('when not possible to fetch messages from source queue', () => {
          let mock_err;

          beforeEach('mockFailedReceive', () => {
            mock_err = new Error('Mocked AWS error');
            receive_message_stub.yieldsAsync(mock_err, null);
          });

          it('should fail with AWS error', () => {
            return redriver.redriveMessages(params).should.be.rejectedWith(mock_err);
          });

          it('should not attempt to add any message to target queue', () => {
            return redriver.redriveMessages(params).catch(() => {
              send_message_stub.should.not.be.called();
            });
          });

          it('should not delete any message', () => {
            return redriver.redriveMessages(params).catch(() => {
              delete_message_stub.should.not.be.called();
            });
          });

        });

        describe('when not possible to add messages to target queue', () => {
          let mock_err;

          beforeEach('mockReceiveOneMessage', () => {
            first_message = mockIncompleteButSufficientSqsMessage('first');
            receive_message_stub.onCall(0).yieldsAsync(null, [first_message]);
            receive_message_stub.onCall(1).yieldsAsync(null, []);
          });

          beforeEach('mockSendMessage', () => {
            const irrelevant_data = {};
            send_message_stub.yieldsAsync(null, irrelevant_data);
          });

          beforeEach('mockFailedDelete', () => {
            mock_err = new Error('Mocked AWS error');
            delete_message_stub.yieldsAsync(mock_err, null);
          });

          it('should fail with AWS error', () => {
            return redriver.redriveMessages(params).should.be.rejectedWith(mock_err);
          });

        });

        describe('when message deletion fails', () => {
          let mock_err;

          beforeEach('mockReceiveOneMessage', () => {
            first_message = mockIncompleteButSufficientSqsMessage('first');
            receive_message_stub.onCall(0).yieldsAsync(null, [first_message]);
            receive_message_stub.onCall(1).yieldsAsync(null, []);
          });

          beforeEach('mockFailedSend', () => {
            mock_err = new Error('Mocked AWS error');
            send_message_stub.yieldsAsync(mock_err, null);
          });

          it('should fail with AWS error', () => {
            return redriver.redriveMessages(params).should.be.rejectedWith(mock_err);
          });

          it('should not delete any message from source queue', () => {
            return redriver.redriveMessages(params).catch(() => {
              delete_message_stub.should.not.be.called();
            });
          });

        });

      });

    });

    describe('with invalid params', () => {
      let params;

      beforeEach(() => {
        params = createValidParams();
      });

      describe('missing sns_event', () => {

        beforeEach(() => {
          delete params.sns_event;
        });

        it('should fail with error', () => {
          return redriver.redriveMessages(params).should.be.rejectedWith({
            code: 422,
          });
        });

      });

      describe('with invalid message JSON', () => {

        beforeEach(() => {
          params.sns_event.Records[0].Sns.Message = {};
        });

        it('should fail with error', () => {
          return redriver.redriveMessages(params).should.be.rejectedWith({
            code: 422,
          });
        });

      });

    });

  });

});

function createValidParams() {
  const sns_event_copy = cloneDeep(sns_event_fixture);
  sns_event_copy.Records[0].Sns.Message = JSON.stringify(test_queue_params);

  return { sns_event: sns_event_copy };
}

function mockIncompleteButSufficientSqsMessage(appendix) {
  return {
    MessageId: `MessageId-${appendix}`,
    ReceiptHandle: `ReceiptHandle-${appendix}`,
    MD5OfBody: `MD5OfBody-${appendix}`,
    Body: `Body-${appendix}`,
  };
}
