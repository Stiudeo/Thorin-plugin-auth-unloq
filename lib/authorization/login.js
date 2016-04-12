'use strict';
/**
 * Created by Adrian on 12-Apr-16.
 */
module.exports = function(thorin, opt, unloqApi) {
  const dispatcher = thorin.dispatcher,
    logger = thorin.logger(opt.logger);

  let sessPluginObj = thorin.plugin(opt.sessionPlugin),
    storeObj = null;
  if (opt.store) {
    if (opt.store instanceof thorin.Interface.Store) {
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
   * */
  dispatcher
    .addAuthorization('auth.unloq.login')
    .input({
      token: dispatcher.validate('STRING').error('AUTH.UNLOQ', 'Missing UNLOQ Access token')
    })
    .use((intentObj, next) => {
      const authToken = intentObj.input('token'),
        sid = intentObj.session ? intentObj.session.id : null;
      let apiOpt;
      if (sid && sessPluginObj) {
        apiOpt = {
          sid: sid,
          duration: sessPluginObj.options.expire
        };
      }
      unloqApi.tokenData(authToken, apiOpt).then((userData) => {
        /* IF we're in production mode, we check the remote IPs. */
        if (thorin.env === 'production') {
          const remoteIp = intentObj.client('ip'),
            userAgent = intentObj.client('headers')['user-agent'] || null;
          let isRequestValid = true;
          if (userData.source_client.ip && userData.source_client.ip !== remoteIp) {
            isRequestValid = false;
          }
          if (userData.source_client['user-agent'] && userData.source_client['user-agent'] !== userAgent) {
            isRequestValid = false;
          }
          if (!isRequestValid) {
            logger.warn(`UAuth login had source client information different from requestor. IP: ${remoteIp} / ${userData.source_client.ip}`);
            return next(thorin.error('AUTH.UNLOQ', 'Please use the same browser when authenticating with UNLOQ', 403));
          }
        }
        //  IF we are not using a sql store, we just set the modelName in the intent's data.
        let AccountModel;
        if (storeObj) {
          AccountModel = storeObj.model(opt.modelName);
        }
        if (!storeObj || !AccountModel) {
          intentObj.data(opt.modelName || "unloq", userData);
          return next();
        }
        let AccountStoreModel = storeObj.model(opt.modelName, true),
          qry = {};
        AccountModel.find(qry).then((accObj) => {
          // IF we have the account
          if (accObj) {
            // At this point, we check if the account has a "is_active" field. If it has and is disabled, we stop here.
            if (AccountStoreModel.fields['is_active'] && accObj.get('is_active') === false) {
              return next(thorin.error('AUTH.UNLOQ.DISABLED', 'This account has been disabled.', 403));
            }
            updateLoginAt(accObj);
            intentObj.data(opt.modelName, accObj);
            dispatcher.emit('auth:history', 'LOGIN', accObj, intentObj);
            return next();
          }
          // IF we don't have an account and registration is disabled, we stop.
          if (!opt.registration) {
            logger.debug(`UAuth user ${userData.id} is new but will not be added.`);
            return next(thorin.error('AUTH.UNLOQ.NOT_FOUND', 'Registration is currently disabled.', 403));
          }
          // IF we have registration, we will create the user.

          accObj = AccountModel.build({
            unloq_id: userData.id
          });
          if (opt.loginAt) {
            accObj.set(opt.loginAt.field, Date.now());
          }
          // IF we have additional information in the userData, we can set it.
          Object.keys(userData).forEach((key) => {
            if (key === 'id') return;
            if (typeof AccountStoreModel.fields[key] === 'undefined') return;
            accObj.set(key, userData[key]);
          });
          accObj.save().then(() => {
            logger.trace(`UNLOQ account ${userData.id} created`);
            intentObj.data(opt.modelName, accObj);
            dispatcher.emit('auth:history', 'LOGIN', accObj, intentObj);
            next();
          }).catch((err) => {
            logger.error(`Failed to save new unloq account ${userData.id} - ${userData.email}`);
            next(thorin.error('AUTH.UNLOQ.ERROR', 'An error occurred. Please try again', 500, err));
          });
        }).catch((err) => {
          logger.error(`Failed to query for account ${userData.id} on uauth login`, err);
          next(thorin.error('AUTH.UNLOQ.ERROR', 'An error occurred. Please try again', 500, err));
        });
      }).catch((err) => {
        logger.debug(`Uauth login result error [${err.code}]`);
        next(thorin.error('AUTH.UNLOQ.' + err.code, err.message, 403), err);
      });
    });

  /*
   * Updates the account's login_at field, if using.
   * */
  function updateLoginAt(accountObj) {
    if (!opt.loginAt) return;
    accountObj.set(opt.loginAt.field, Date.now());
    accountObj.save().catch((err) => {
      logger.error(`Failed to update loginAt field for unloq account ` + accountObj.get(opt.unloqId.field), err);
    });
  }
};