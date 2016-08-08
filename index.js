'use strict';
const unloq = require('unloq'),
  initModels = require('./lib/initModels');
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
    key: null,         // the UNLOQ API Key
    secret: null       // the UNLOQ API Secret
  }, opt);
  const logger = thorin.logger(opt.logger);
  const modelLoader = initModels(thorin, opt);
  if(!opt.key) {
    logger.fatal('Missing API Key');
  }
  if(!opt.secret) {
    logger.fatal('Missing API Secret');
  }

  var apiObj = new unloq.Api({
    key: opt.key,
    secret: opt.secret,
    gateway: opt.gateway,
    endpoint: "",
    version: opt.version || "1"
  });
  /* Require our authorization actions */
  thorin.loadPath(__dirname + '/lib/authorization', thorin, opt, apiObj);
  const PLUGIN_URL = 'https://api.unloq.io/login.js';
  /* Expose the setup() function */
  apiObj.setup = function(done) {
    if(!modelLoader.setup) return done();
    modelLoader.setup();
    done();
  };

  /* Expose the unloq API */
  apiObj.api = apiObj;

  /* Expose the options */
  apiObj.options = opt;

  /* Returns the full login <script> tag location*/
  apiObj.getScript = function(theme) {
    if(!theme) theme = 'light';
    return '<script type="text/javascript" src="'+PLUGIN_URL+'" data-unloq-theme="'+theme+'" data-unloq-key="'+opt.key+'"></script>';
  }
  return apiObj;
};
module.exports.publicName = 'auth-unloq';