/* eslint-disable prefer-const, global-require, babel/new-cap, require-await */
process.env.NODE_ENV = 'development';
import path from 'path';
import fs from 'fs-extra';
import webpack from 'webpack';
import openBrowser from 'react-dev-utils/openBrowser';
import WebpackDevServer from 'webpack-dev-server';

function createRunOnceCompiler(webpackConfig: Object): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      webpack(webpackConfig, (err, stats) => {
        if (err || stats.hasErrors()) {
          return reject(err);
        }

        return resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

const debug = require('debug')('boldr:webpack:dev');

const plugin: Plugin = (
  engine: Engine,
  runOnce: boolean = false,
  logger: Logger,
): PluginController => {
  let clientLogger, serverLogger, serverCompiler, clientDevServer;
  const { env: envVariables, settings } = engine.getConfiguration();

  return {
    async start() {
      clientLogger = logger.createGroup('client');
      serverLogger = logger.createGroup('server');
      const clientConfig = require('../webpack/browser/webpack.dev.config')(
        engine,
        clientLogger,
      );
      const serverConfig = require('../webpack/node/webpack.dev.config')(
        engine,
        serverLogger,
      );

      return new Promise((resolve, reject) => {
        try {
          const clientCompiler = webpack(clientConfig);

          clientDevServer = new WebpackDevServer(clientCompiler, {
            clientLogLevel: 'none',
            contentBase: envVariables.PUBLIC_DIR,
            historyApiFallback: {
              disableDotRule: true,
            },
            https: settings.client.protocol === 'https',
            host: 'localhost',
            hot: true,
            proxy: {
              '!(/__webpack_hmr|**/*.*)': `http://localhost:${envVariables.SERVER_PORT}`,
            },
            publicPath: '/',
            quiet: true,
            watchOptions: {
              ignored: /node_modules/,
            },
          });

          clientDevServer.listen(envVariables.SERVER_PORT - 1, err => {
            if (err) {
              console.log(err);
              return reject(err);
            }

            return openBrowser(
              `${settings.client.protocol || 'http'}://localhost:${envVariables.SERVER_PORT - 1}/`,
            );
          });

          serverCompiler = webpack({
            ...serverConfig,
            watchOptions: {
              ignored: /node_modules/,
            },
          }).watch({}, () => {});
        } catch (e) {
          reject(e);
        }

        resolve();
      });
    },

    async terminate() {
      clientLogger.remove();
      serverLogger.remove();

      if (serverCompiler) {
        return Promise.all([
          new Promise(resolve => serverCompiler.close(resolve)),
          new Promise(resolve => clientDevServer.close(resolve)),
        ]);
      }

      return true;
    },
  };
};

module.exports = plugin;
