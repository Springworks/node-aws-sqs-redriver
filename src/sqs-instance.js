import AWS from 'aws-sdk';
import config from 'config';

const api_version = config.get('aws.api_version');
export default new AWS.SQS({ api_version: api_version });
