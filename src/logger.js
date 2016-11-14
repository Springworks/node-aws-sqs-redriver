import config from 'config';
import { createLambdaLogger as createLogger } from '@springworks/logger-factory';

const log_level = config.get('logging.level');
const name = config.get('logging.name');

export default createLogger(name, log_level);
