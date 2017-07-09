import Debug from 'debug';
import errors from 'feathers-errors';
import Web3 from 'web3';
import utils from 'ethereumjs-util';

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
      throw new errors.BadRequest(`'${this.options.entity}' record in the database is missing a '${this.options.nonceField}' field`)
    }

    if (!entity[this.options.publicKeyField]) {
      throw new errors.BadRequest(`'${this.options.entity}' record in the database is missing a '${this.options.nonceField}' field`)
    }

    debug('Verifying signature');

    // First we hash the user's nonce using SHA3
    const web3 = new Web3();
    const hashedNonce = web3.sha3(entity.nonce.toString());

    // Then follow this tutorial
    // https://ethereum.stackexchange.com/questions/2660/how-can-i-verify-a-signature-with-the-web3-javascript-api
    const r = utils.toBuffer(signature.slice(0,66));
    const s = utils.toBuffer('0x' + signature.slice(66,130));
    const v = utils.bufferToInt(utils.toBuffer('0x' + signature.slice(130,132)));
    const m = utils.toBuffer(hashedNonce);
    const pub = utils.ecrecover(m, v, r, s);
    const adr = '0x' + utils.pubToAddress(pub).toString('hex');

    if (adr === entity[this.options.publicKeyField].toLowerCase()) {
      return Promise.resolve(entity);
    } else {
      return Promise.reject(new errors.NotAuthenticated('Signature verification failed'));
    }
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

  verify(findByValue, signature, done) {
    debug('Checking credentials', findByValue, signature);
    const query = {
      [this.options.findBy]: findByValue,
      $limit: 1
    };

    // Look up the entity
    this.service.find({ query })
      .then(this._normalizeResult)
      .then(entity => this._verifySignature(entity, signature))
      .then(entity => {
        const id = entity[this.service.id];
        const payload = { [`${this.options.entity}Id`]: id };
        done(null, entity, payload);
      })
      .catch(error => error ? done(error) : done(null, error));
  }
}

export default PublicKeyVerifier;
