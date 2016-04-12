'use strict';
/**
 * Created by Adrian on 12-Apr-16.
 */
module.exports = function(thorin, opt, unloqApi) {
  const dispatcher = thorin.dispatcher,
    logger = thorin.logger(opt.logger);

  let sessPluginObj = thorin.plugin(opt.sessionPlugin),
    storeObj = null;
  if(opt.store) {
    if(opt.store instanceof thorin.Interface.Store) {
      storeObj = opt.store;
    } else {
      thorin.on(thorin.EVENT.INIT, 'store.' + opt.store, (obj) => {
        storeObj = obj;
      });
    }
  }

  /*
   * This is the UNLOQ Login authorization action.
   * It creates authorization "auth.unloq.login"
   * OPTIONS:
   *  path -> if specified, the logout path that we're handling
   * */
  dispatcher
    .addAuthorization('auth.unloq.logout')
    .input({
      id: dispatcher.validate('NUMBER').error('AUTH.UNLOQ', 'Invalid session ID.'),
      key: dispatcher.validate('STRING').error('AUTH.UNLOQ', 'Invalid api key'),
      sid: dispatcher.validate('STRING').error('AUTH.UNLOQ', 'Invalid sess id')
    })
    .use((intentObj, next, logoutOpt) => {
      if(intentObj.input('key') !== opt.apiKey) {
        return next(thorin.error('AUTH.UNLOQ', 'Invalid api key'));
      }
      let logoutPath = logoutOpt.path || intentObj.alias || null;
      // IF we have a logoutPath available, we verify the signature.
      if(logoutPath) {
        let headers = intentObj.client('headers'),
          unloqSignature = headers['x-unloq-signature'] || null;
        if(!unloqSignature) {
          return next(thorin.error('AUTH.UNLOQ', 'Missing hook signature.'));
        }
        if(!unloqApi.verifySign(unloqSignature, logoutPath, intentObj.input())) {
          return next(thorin.error('AUTH.UNLOQ', 'Invalid hook signature.'));
        }
      }
      let sid = intentObj.input('sid');
      // at this point, we just have to delete the session and that's it.
      if(!sessPluginObj) {
        intentObj.data('sid', sid);
        return next();
      }
      sessPluginObj.destroySession(sid, (err) => {
        if(err) {
          logger.warn('Session store failed to destroy session ' + sid + ' for remote logout');
          return next(thorin.error('AUTH.UNLOQ', 'Failed to destroy session', 500, err));
        }
        logger.debug('Remote logout closed session ' + sid);
        next();
      });
    });

};