'use strict';
const unloq = require('unloq'),
  initModels = require('./lib/initModels');
const PLUGIN_URL = 'https://plugin.unloq.io/login.js';
/**
 * Created by Adrian on 08-Apr-16.
 * UNLOQ.io authhorization middleware for thorin.
 */
module.exports = function(thorin, opt, pluginName) {
  opt = thorin.util.extend({
    logger: pluginName || 'auth-unloq',
    store: 'sql',               // Do we work with an SQL store and a model? If so, we will use it.
    modelName: 'account',
    unloqId: {
      field: 'unloq_id',
      options: {}
    },
    loginAt: {                  // Do we want to attach to the SQL model the login_at field?
      field: 'login_at',
      options: {}
    },
    registration: true,         // IF we do not have the user locally, we create it.
    sessionPlugin: 'session',   // setting it to null will not handle automatica remote logout
    apiKey: null,         // the UNLOQ API Key
    apiSecret: null       // the UNLOQ API Secret
  }, opt);
  const logger = thorin.logger(opt.logger);
  const modelLoader = initModels(thorin, opt);
  if(!opt.apiKey) {
    logger.fatal('Missing API Key');
  }
  if(!opt.apiSecret) {
    logger.fatal('Missing API Secret');
  }

  var apiObj = new unloq.Api({
    key: opt.apiKey,
    secret: opt.apiSecret
  });
  /* Require our authorization actions */
  thorin.loadPath(__dirname + '/lib/authorization', thorin, opt, apiObj);

  /* Expose the setup() function */
  apiObj.setup = function(done) {
    if(!modelLoader.setup) return done();
    modelLoader.setup();
    done();
  };

  /* Expose the options */
  apiObj.options = opt;

  /* Returns the full login <script> tag location*/
  apiObj.getScript = function(theme) {
    if(!theme) theme = 'light';
    return '<script type="text/javascript" src="'+PLUGIN_URL+'" data-unloq-theme="'+theme+'" data-unloq-key="'+opt.apiKey+'"></script>';
  }
  return apiObj;
};