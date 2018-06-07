import redriver from '../../build/sqs-redriver';
import autorestoredSandbox from '@springworks/test-harness/autorestored-sandbox';
import { handler } from '../../index';

const sns_event_fixture = require('../../test-util/fixtures/sns-event.json');

describe('test/unit/handler-test.js', () => {

  const sinon_sandbox = autorestoredSandbox();
  let redrive_messages_stub;
  const context = {
    functionName: 'ReDriveQueueMessages',
  };

  it('handler should call redrive messages and callback when succesful', done => {
    redrive_messages_stub = sinon_sandbox.stub(redriver, 'redriveMessages').resolves();
    handler(sns_event_fixture, context, err => {
      (err === undefined).should.eql(true);
      done();
    });
    redrive_messages_stub.should.have.callCount(1);
    redrive_messages_stub.getCalls()[0].args[0].sns_event.should.eql(sns_event_fixture);
  });

  it('handler should call callback with error when failing', done => {
    const error = new Error('some error');
    redrive_messages_stub = sinon_sandbox.stub(redriver, 'redriveMessages').rejects(error);
    handler(sns_event_fixture, context, err => {
      err.should.eql(error);
      done();
    });
  });


});
