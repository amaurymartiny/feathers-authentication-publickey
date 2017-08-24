import Debug from 'debug';
import hooks from './hooks';
import DefaultVerifier from './verifier';
import { Strategy as PublicKeyStrategy } from 'passport-publickey';

const debug = Debug('feathers-authentication-publickey');
const defaults = {
  name: 'publicKey', // Name of this auth for feathers-authentication
  entity: 'user', // Entity to look in the DB
  service: 'users', // Service to call in your feathers app
  findBy: 'id', // Field to uniquely find the user by
  in: 'body', // Where in the request is the data? request.body, request.headers, request.params...
  publicKeyField: 'publicKey', // Field in the entity model for publicKey
  nonceField: 'nonce', // Field in the entity model for nonce
  passReqToCallback: false, // See passport strategy
};

export default function init(options = {}) {
  return function publicKeyAuth() {
    const app = this;
    const _super = app.setup;

    if (!app.passport) {
      throw new Error(`Can not find app.passport. Did you initialize feathers-authentication before feathers-authentication-publickey?`);
    }

    let name = options.name || defaults.name;
    let authOptions = app.get('authentication') || {};
    let publicKeyOptions = authOptions[name] || {};

    // NOTE (EK): Pull from global auth config to support legacy auth for an easier transition.
    const publicKeySettings = Object.assign({}, defaults, publicKeyOptions, options);
    let Verifier = DefaultVerifier;

    if (options.Verifier) {
      Verifier = options.Verifier;
    }

    app.setup = function () {
      let result = _super.apply(this, arguments);
      let verifier = new Verifier(app, publicKeySettings);

      if (!verifier.verify) {
        throw new Error(`Your verifier must implement a 'verify' function. It should have the same signature as a publicKey passport verify callback.`)
      }

      // Register 'publicKey' strategy with passport
      debug('Registering publicKey authentication strategy with options:', publicKeySettings);
      app.passport.use(publicKeySettings.name, new PublicKeyStrategy(publicKeySettings, verifier.verify.bind(verifier)));
      app.passport.options(publicKeySettings.name, publicKeySettings);

      return result;
    }
  };
}

// Exposed Modules
Object.assign(init, {
  defaults,
  hooks,
  Verifier: DefaultVerifier
});
