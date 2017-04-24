import fs from 'fs';
import path from 'path';
import json5 from 'json5';
import deepExtend from './util/deepExtend';
import displayConfig from './displayConfig';

// Lazy loaded
let yaml;

class BoldrConfig {
  constructor(applicationName, defaults, opts) {
    opts || (opts = {});
    opts.argv || (opts.argv = process.argv);
    opts.env || (opts.env = process.env);
    opts.platform || (opts.platform = process.platform);
    opts.cwd || (opts.cwd = process.cwd());
    opts.unsetEnvValues || (opts.unsetEnvValues = false);
    opts.parseValues || (opts.parseValues = true);

    if (typeof applicationName !== 'string') {
      throw new Error('applicationName must be a string');
    }
    if (!defaults || typeof defaults !== 'object') {
      throw new Error('defaults must be an object');
    }

    this.__$ = {};
    this.__$.applicationName = applicationName;
    this.__$.defaults = deepExtend({}, defaults);
    this.__$.argv = opts.argv;
    this.__$.env = opts.env;
    this.__$.platform = opts.platform;
    this.__$.cwd = opts.cwd;
    this.__$.unsetEnvValues = opts.unsetEnvValues;
    this.__$.parseValues = opts.parseValues;
    this.__$.configFlagPath = '';
    this.__$.config = null;

    this._compileConfig();
  }

  display() {
    const explanation = deepExtend({}, this.__$.defaults);
    const configs = this._getConfigDataAndPaths();
    const flagData = this._getFlagData();
    const envData = this._getEnvData();

    this._resolveTemplatedValues(envData);
    this._resolveTemplatedValues(flagData);
    this._resolveTemplatedValues(explanation);
    for (const config of configs) {
      this._resolveTemplatedValues(config);
    }

    const setValSrcRec = (ctx, src) => {
      for (const key in ctx) {
        if (
          ctx[key] &&
          typeof ctx[key] === 'object' &&
          !(ctx[key] instanceof RegExp)
        ) {
          setValSrcRec(ctx[key], src);
        } else {
          ctx[key] = { val: ctx[key], src };
        }
      }
    };

    setValSrcRec(explanation, 'defaults');
    setValSrcRec(flagData, 'flag');
    setValSrcRec(envData, 'environment');
    for (let i = 0; i < configs.length; i += 1) {
      const absPath = configs[i].path;
      const relPath = path.relative(this.__$.cwd, absPath);
      setValSrcRec(
        configs[i].data,
        absPath.length > relPath.length ? relPath : absPath,
      );
    }

    for (let i = 0; i < configs.length; i += 1) {
      deepExtend(explanation, configs[i].data);
    }
    deepExtend(explanation, envData);
    deepExtend(explanation, flagData);

    return explanation;
  }

  displayConfig() {
    displayConfig(this.__$.applicationName, this.display());
  }

  toObject() {
    return deepExtend({}, this.__$.config);
  }

  _compileConfig() {
    const config = deepExtend({}, this.__$.defaults);
    deepExtend(config, this._getMergedConfigData());
    deepExtend(config, this._getEnvData());
    deepExtend(config, this._getFlagData());

    this._resolveTemplatedValues(config);

    this.__$.config = config;

    for (const prop in config) {
      if (this[prop]) {
        continue; // eslint-disable-line
      }
      this[prop] = config[prop];
    }
  }

  _getFlagData() {
    if (this.__$.argv.config) {
      this.__$.configFlagPath = this.__$.argv.config;
    }

    const flags = [];
    for (let i = 0; i < this.__$.argv.length; i += 1) {
      const key = this.__$.argv[i];
      const val = this.__$.argv[i + 1];
      if (key.slice(0, 2) !== '--') {
        continue; // eslint-disable-line
      }
      flags[key.slice(2)] = val;
      i += 1;
    }

    const flagData = {};
    for (const flag in flags) {
      if (flag === '_') {
        continue; // eslint-disable-line
      }
      this.constructor._setPath(
        flagData,
        this._convertFlagToPath(flag),
        flags[flag],
      );
    }
    return flagData;
  }

  _getMergedConfigData() {
    const configData = {};
    const configs = this._getConfigDataAndPaths();

    for (let i = 0; i < configs.length; i += 1) {
      deepExtend(configData, configs[i].data);
    }

    return configData;
  }

  _getConfigDataAndPaths() {
    return this._collectConfigPaths().map(configPath => {
      const src = fs.readFileSync(configPath, 'utf8');
      const ext = path.extname(configPath);
      let data;

      try {
        switch (ext) {
          case '.json':
            data = this.constructor._parseJson(src);
            break;
          case '.yaml':
            data = this.constructor._parseYaml(src);
            break;
          default:
            data = this.constructor._tryParse(src);
            break;
        }
      } catch (err) {
        throw new Error(
          `Failed to parse config file at path ${configPath}: ` +
            `${err.message}`,
        );
      }

      if (!data) {
        console.warn(
          `Failed to parse config ${configPath}. Note that yaml ` +
            'config files require modules `js-yaml` to be ' +
            'installed. Skipping unparsable config.',
        );
      }

      return { path: configPath, data };
    });
  }

  _collectConfigPaths() {
    if (this.__$.configFlagPath) {
      if (
        fs.existsSync(this.__$.configFlagPath) &&
        fs.statSync(this.__$.configFlagPath).isFile()
      ) {
        throw new Error(`${this.__$.configFlagPath} does not exist`);
      }
      return [this.__$.configFlagPath];
    }

    let configPaths = [];
    const cwdPathChunks = this.__$.cwd.slice(1).split(path.sep);
    while (cwdPathChunks.length > 0) {
      const basePath = cwdPathChunks.join(path.sep);
      // ./.boldrrc
      // ../.boldrrc
      // ../../.boldrrc
      // ../../../.boldrrc
      // etc...
      configPaths.push(
        path.sep + path.join(basePath, `.${this.__$.applicationName}rc`),
      );
      cwdPathChunks.pop();
    }

    for (let i = 0, len = configPaths.length; i < len; i += 1) {
      const configPath = configPaths.shift();
      configPaths.push(configPath, `${configPath}.json`, `${configPath}.yaml`);
    }

    configPaths = configPaths.filter(
      configPath =>
        fs.existsSync(configPath) && fs.statSync(configPath).isFile(),
    );

    return configPaths;
  }

  _getEnvData() {
    const data = {};
    for (const key in this.__$.env) {
      if (!this._envKeyBelongsToApp(key)) {
        continue; // eslint-disable-line
      }

      const path = this._convertEnvKeyToPath(key);
      const val = this._parseValue(this.__$.env[key]);
      this.constructor._setPath(data, path, val);

      if (this.__$.unsetEnvValues) {
        delete this.__$.env[key];
      }
    }

    return data;
  }

  _parseValue(val) {
    if (!this.__$.parseValues) {
      return val;
    }

    if (val === 'null') {
      return null;
    }
    if (val === 'true') {
      return true;
    }
    if (val === 'false') {
      return false;
    }
    if (val === 'NaN') {
      return NaN;
    }

    if (val.match(/^\d+$/)) {
      const num = parseFloat(val);
      if (num.toString() === val) {
        return num;
      }
    }

    return val;
  }

  _envKeyBelongsToApp(key) {
    return (
      key.slice(0, this.__$.applicationName.length + 2).toLowerCase() ===
      `${this.__$.applicationName.toLowerCase().replace(/[^\w\d]+/g, '_')}__`
    );
  }

  _convertEnvKeyToPath(key) {
    key = key
      .slice(this.__$.applicationName.length + 2)
      .toLowerCase()
      .replace(/__/g, '.')
      .replace(/_([\w])/g, (_, char) => char.toUpperCase());
    return key;
  }

  _convertFlagToPath(key) {
    key = key
      .replace(/_{2}|-{2}/g, '.')
      .replace(/[_-]([\w])/g, (_, char) => char.toUpperCase());
    return key;
  }

  _resolveTemplatedValues(config) {
    const templateObj = ctx => {
      for (const prop in ctx) {
        if (!ctx[prop]) {
          continue; // eslint-disable-line
        }

        if (typeof ctx[prop] === 'object') {
          templateObj(ctx[prop]);
          continue; // eslint-disable-line
        }

        if (typeof ctx[prop] === 'string') {
          const envVarRegex = /\$\{[^}]+\}/g;
          const envVarMatches = ctx[prop].match(envVarRegex);
          if (envVarMatches) {
            for (let i = 0; i < envVarMatches.length; i += 1) {
              const token = envVarMatches[i];
              const key = token.slice(2, token.length - 1);
              const envVal = process.env && process.env[key] !== undefined
                ? process.env[key]
                : '';

              ctx[prop] = ctx[prop].replace(token, envVal);
            }
          }

          const inlinePathRegex = /\$\([^)]+\)/g;
          const inlinePathMatches = ctx[prop].match(inlinePathRegex);
          if (inlinePathMatches) {
            for (let i = 0; i < inlinePathMatches.length; i += 1) {
              const token = inlinePathMatches[i];
              const path = token.slice(2, token.length - 1);
              const fileVal = fs.existsSync(path) && fs.statSync(path).isFile()
                ? fs.readFileSync(path)
                : '';

              ctx[prop] = ctx[prop].replace(token, fileVal);
            }
          }

          const typeCastRegex = /^(boolean|number|string|json|regex):(.+)$/m;
          const typeCastMatch = ctx[prop].match(typeCastRegex);

          if (typeCastMatch) {
            const type = typeCastMatch[1];
            let val = typeCastMatch[2];

            switch (type) {
              case 'boolean':
                val = !!val;
                break;
              case 'number':
                val = parseFloat(val || 0);
                break;
              case 'json':
                val = json5.parse(val);
                break;
              case 'regex':
                val = new RegExp(val);
                break;
              default:
                break;
            }

            ctx[prop] = val;
          }
        }
      }
    };

    templateObj(config);
  }
}

BoldrConfig._guessIsJson = function _guessIsJson(src) {
  return !!src
    // remove leading whitespace
    .replace(/^\s+/, '')
    // strip comments
    .replace(/\/\/[^\n]+/g, '')
    // check for the beginning of an object
    .match(/^\{/);
};

BoldrConfig._guessIsYaml = function _guessIsYaml(src) {
  return !!src
    // remove leading whitespace
    .replace(/^\s+/, '')
    // remove comments
    .replace(/#[^\n]+/g, '')
    // match a yaml key
    .match(/^[^:\n]+:/);
};

BoldrConfig._tryParse = function _tryParse(src) {
  let tryParsers, data;
  if (this._guessIsJson(src)) {
    tryParsers = [this._parseJson, this._parseYaml];
  } else if (this._guessIsYaml(src)) {
    tryParsers = [this._parseYaml, this._parseJson];
  }

  for (let i = 0; i < tryParsers.length; i += 1) {
    try {
      data = tryParsers[i](src);
    } catch (err) {
      data = null;
    }
    if (data) {
      break;
    }
  }
  return data || {};
};

BoldrConfig._parseJson = function _parseJson(src) {
  return json5.parse(src);
};

BoldrConfig._parseYaml = function _parseYaml(src) {
  yaml || (yaml = global.__testYaml__ || require('js-yaml'));
  return yaml.safeLoad(src);
};

BoldrConfig._setPath = function _setPath(ctx, ctxPath, val) {
  const pathChunks = ctxPath.split('.');
  for (let i = 0; i < pathChunks.length - 1; i += 1) {
    if (typeof ctx[pathChunks[i]] !== 'object') {
      if (
        pathChunks[i + 1] !== undefined &&
        parseFloat(pathChunks[i + 1]).toString() === pathChunks[i + 1]
      ) {
        ctx[pathChunks[i]] = [];
      } else {
        ctx[pathChunks[i]] = {};
      }
    }
    ctx = ctx[pathChunks[i]];
  }
  ctx[pathChunks.pop()] = val;
};

module.exports = BoldrConfig;
