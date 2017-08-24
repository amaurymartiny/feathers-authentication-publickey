import Debug from 'debug';
import errors from 'feathers-errors';
import Web3 from 'web3';
import utils from 'ethereumjs-util';
import omit from 'lodash.omit';

const debug = Debug('feathers-authentication-publickey:verify');

class PublicKeyVerifier {
  constructor(app, options = {}) {
    this.app = app;
    this.options = options;
    this.service = typeof options.service === 'string' ? app.service(options.service) : options.service;

    if (!this.service) {
      throw new Error(`options.service does not exist.\n\tMake sure you are passing a valid service path or service instance and it is initialized before feathers-authentication-publickey.`);
    }

    this._verifySignature = this._verifySignature.bind(this);
    this._normalizeResult = this._normalizeResult.bind(this);
    this.verify = this.verify.bind(this);
  }

  _verifySignature(entity, signature) {
    if (!entity[this.options.nonceField]) {
      return Promise.reject(new errors.BadRequest(`'${this.options.entity}' record in the database is missing a '${this.options.nonceField}' field`));
    }

    if (!entity[this.options.publicKeyField]) {
      return Promise.reject(new errors.BadRequest(`'${this.options.entity}' record in the database is missing a '${this.options.publicKeyField}' field`));
    }

    debug('Verifying signature');

    // First we hash the user's nonce using SHA3
    const web3 = new Web3();
    const hashedNonce = web3.sha3(entity.nonce.toString());

    return new Promise((resolve, reject) => {
      let adr; // The public address retrieved from the signature
      try {
        // Then follow this tutorial
        // https://ethereum.stackexchange.com/questions/2660/how-can-i-verify-a-signature-with-the-web3-javascript-api
        const r = utils.toBuffer(signature.slice(0,66));
        const s = utils.toBuffer('0x' + signature.slice(66,130));
        const v = utils.bufferToInt(utils.toBuffer('0x' + signature.slice(130,132)));
        const m = utils.toBuffer(hashedNonce);
        const pub = utils.ecrecover(m, v, r, s);
        adr = '0x' + utils.pubToAddress(pub).toString('hex');
      } catch(error) {
        return reject(new errors.NotAuthenticated('Invalid signature'));
      }

      if (adr === entity[this.options.publicKeyField].toLowerCase()) {
        return resolve(entity);
      } else {
        return reject(new errors.NotAuthenticated('Signature verification failed'));
      }
    });
  }

  _normalizeResult(results) {
    // Paginated services return the array of results in the data attribute.
    let entities = results.data ? results.data : results;
    let entity = entities[0];

    // Handle bad username.
    if (!entity) {
      return Promise.reject(false);
    }

    debug(`${this.options.entity} found`);
    return Promise.resolve(entity);
  }

  verify(req, findByValue, signature, done) {
    debug('Checking credentials', findByValue, signature);
    const id = this.service.id;
    const params = Object.assign({
      query: {
        [this.options.findBy]: findByValue,
        $limit: 1
      }
    }, omit(req.params, 'query', 'provider', 'headers', 'session', 'cookies'));

    if (id === null || id === undefined) {
      debug('failed: the service.id was not set');
      return done(new Error('the `id` property must be set on the entity service for authentication'))
    }

    // Look up the entity
    this.service.find(params)
      .then(this._normalizeResult)
      .then(entity => this._verifySignature(entity, signature))
      .then(entity => {
        const id = entity[this.service.id];
        const payload = { [`${this.options.entity}Id`]: id };
        done(null, entity, payload);
      })
      .catch(error => error ? done(error) : done(null, error, { message: 'Signature verification failed'}));
  }
}

export default PublicKeyVerifier;
