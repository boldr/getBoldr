/* eslint-disable no-console */
import path from 'path';
import url from 'url';
import shell from 'shelljs';
import merge from 'lodash/merge';
import { logger } from 'boldr-utils';

const paths = require('../config/paths');


module.exports = (optionalConfig) => {
  let config;

  // base config options
  const baseConfig = {
    productionPublicPath: '/assets/',
    serverPort: 3000,
    serverHost: 'localhost',
    hmrPort: 3001,
    isVerbose: true,
    enableDebug: false,
    reactHotLoader: true,
  };

  const boldrConfigPath = optionalConfig
    ? path.join(paths.ROOT_DIR, optionalConfig)
    : paths.USER_BOLDR_CONFIG_PATH;

  // Find user config
  if (shell.test('-f', boldrConfigPath)) {
    try {
      logger.log('');
      logger.info(`Using boldr-dx config at ${boldrConfigPath}`);
      // eslint-disable-next-line global-require,import/no-dynamic-require
      config = require(boldrConfigPath);
    } catch (error) {
      logger.error('Error loading your boldr.config.js:', error);
      process.exit();
    }
  }

  config = merge({}, baseConfig, config);
  // Create default identity functions for modify functions
  ['editWebpackCfg', 'modifyJestConfig'].forEach((m) => {
    if (typeof config[m] !== 'function') {
      config[m] = c => c;
    }
  });

  return Object.freeze(config);
};