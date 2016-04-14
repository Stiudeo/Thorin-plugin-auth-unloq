'use strict';
/**
 * Created by Adrian on 11-Apr-16.
 */
module.exports = function(thorin, opt) {

  const loader = {};
  const logger = thorin.logger(opt.logger);

  let storeObj, Seq;
  if(!opt.store) return;  //  nothing to setup.
  if(opt.store instanceof thorin.Interface.Store) {
    storeObj = opt.store;
    Seq = storeObj.getSequelize();
    loader.init();
  } else {
    thorin.on(thorin.EVENT.INIT, 'store.' + opt.store, (store) => {
      storeObj = store;
      Seq = storeObj.getSequelize();
      loader.init();
    });
  }

  /*
  * Init the models.
  * */
  loader.init = function() {
    let AccountModel = storeObj.model(opt.modelName);
    if(!AccountModel) {
      logger.fatal('SQL store does not have auth model: ' + opt.modelName);
      return false;
    }
    // Check if we have to attach the unloq_id field.
    if(!AccountModel.fields[opt.unloqId.field]) {
      let fieldOpt = {
        defaultValue: null,
        allowNull: true,
        filter: false
      };
      fieldOpt = thorin.util.extend(fieldOpt, opt.unloqId.options);
      AccountModel.field(opt.unloqId.field, Seq.STRING(20), fieldOpt);
      if(!AccountModel.hasIndex(opt.unloqId.field)) {
        AccountModel.index(opt.unloqId.field);
      }
    }
    // Check if we have to attach the loginAt field.
    if(opt.loginAt && !AccountModel.fields[opt.loginAt.field]) {
      let fieldOpt = {
        private: true,
        defaultValue: null,
        allowNull: true
      };
      fieldOpt = thorin.util.extend(fieldOpt, opt.loginAt.options);
      AccountModel.field(opt.loginAt.field, Seq.DATE, fieldOpt);
    }
  };


  /*
  * Setup the DB
  * */
  loader.setup = function() {
    logger.info('Setting up db models once store %s is running', storeObj.name);
    thorin.on(thorin.EVENT.RUN, 'store.' + storeObj.name, () => {
      storeObj.sync(opt.modelName).catch((err) => {
        logger.error('Failed to sync db models', err);
      });
    });
  };
  return loader;
};