import feathers from 'feathers';
import authentication from 'feathers-authentication';
import { Verifier, defaults } from '../src';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

describe('Verifier', () => {
  let service;
  let app;
  let options;
  let verifier;
  let user;
  // Message '100' signed by 0x0b664ebf14e204cde96690461830e0dd5dfb22aa: web3.eth.sign('0x0b664ebf14e204cde96690461830e0dd5dfb22aa', '100');
  const correctSignature = '0x5909004173042d7b42a110c1f3325b704ca6361fc29698051955c7b002af5ffd2bcb379cc58ca331606dfed5d78f08651e20efa763e00ad9ba80a7c3397a16a81b';

  beforeEach(() => {
    app = feathers();

    service = {
      id: 'id',
      find () {}
    };

    sinon.stub(service, 'find').callsFake(function (params) {
      return new Promise((resolve, reject) => {
        const { id, email } = params && params.query;
        if (id === 1 || email === 'admin@feathersjs.com') {
          return resolve([user]);
        }
        return resolve([]);
      });
    });

    user = {
      id: 1,
      nonce: 100,
      publicKey: '0x0b664ebf14e204cde96690461830e0dd5dfb22aa'
    };

    app.use('/users', service)
      .configure(authentication({ secret: 'supersecret' }));

    options = Object.assign({}, defaults, app.get('authentication'));

    verifier = new Verifier(app, options);
  });

  it('is CommonJS compatible', () => {
    expect(typeof require('../lib/verifier')).to.equal('function');
  });

  it('exposes the Verifier class', () => {
    expect(typeof Verifier).to.equal('function');
  });

  describe('constructor', () => {
    it('retains an app reference', () => {
      expect(verifier.app).to.deep.equal(app);
    });

    it('sets options', () => {
      expect(verifier.options).to.deep.equal(options);
    });

    it('sets service using service path', () => {
      expect(verifier.service).to.deep.equal(app.service('users'));
    });

    it('sets a passed in service instance', () => {
      options.service = service;
      expect(new Verifier(app, options).service).to.deep.equal(service);
    });

    describe('when service is undefined', () => {
      it('throws an error', () => {
        expect(() => new Verifier(app, {})).to.throw();
      });
    });
  });

  describe('_verifySignature', () => {
    describe('when entity is missing nonce field', () => {
      it('returns an error', () => {
        return verifier._verifySignature({}).catch(error => {
          expect(error).to.not.equal(undefined);
          expect(error.message).to.equal("'user' record in the database is missing a 'nonce' field");
        });
      });
    });

    describe('when entity is missing signature field', () => {
      it('returns an error', () => {
        return verifier._verifySignature({ nonce: 100 }).catch(error => {
          expect(error).to.not.equal(undefined);
          expect(error.message).to.equal("'user' record in the database is missing a 'publicKey' field");
        });
      });
    });

    describe('when invalid signature is given', () => {
      it('rejects with with a 401 error', () => {
        return verifier._verifySignature(user, 'invalid').catch(error => {
          expect(error).to.include({
            name: 'NotAuthenticated',
            code: 401,
            message: 'Invalid signature'
          });
        });
      });
    });

    describe('when signature/publicKey combination is wrong', () => {
      it('rejects with with a 401 error', () => {
        return verifier._verifySignature(Object.assign({}, user, { publicKey: '0x123' }), correctSignature).catch(error => {
          expect(error).to.include({
            name: 'NotAuthenticated',
            code: 401,
            message: 'Signature verification failed'
          });
        });
      });
    });

    describe('when signature verification succeeds', () => {
      it('returns the entity', () => {
        return verifier._verifySignature(user, correctSignature).then(result => {
          expect(result).to.deep.equal(user);
        });
      });
    });
  });

  describe('_normalizeResult', () => {
    describe('when has results', () => {
      it('returns entity when paginated', () => {
        return verifier._normalizeResult({ data: [user] }).then(result => {
          expect(result).to.deep.equal(user);
        });
      });

      it('returns entity when not paginated', () => {
        return verifier._normalizeResult([user]).then(result => {
          expect(result).to.deep.equal(user);
        });
      });
    });

    describe('when no results', () => {
      it('rejects with false when paginated', () => {
        return verifier._normalizeResult({ data: [] }).catch(error => {
          expect(error).to.equal(false);
        });
      });

      it('rejects with false when not paginated', () => {
        return verifier._normalizeResult([]).catch(error => {
          expect(error).to.equal(false);
        });
      });
    });
  });

  describe('verify', () => {
    it('calls find on the provided service', done => {
      verifier.verify({}, user.id, correctSignature, () => {
        const query = { id: user.id, $limit: 1 };
        expect(service.find).to.have.been.calledOnce; // eslint-disable-line
        expect(service.find).to.have.been.calledWith({ query });
        done();
      });
    });

    it('allows overriding of publicKeyField', done => {
      verifier.options.publicKeyField = 'publicAddress';

      user.publicAddress = user.publicKey;

      verifier.verify({}, user.id, correctSignature, (error, entity) => {
        expect(error).to.equal(null);
        expect(entity).to.deep.equal(user);
        done();
      });
    });

    it('allows overriding of nonceField', done => {
      verifier.options.nonceField = 'publicNonce';

      user.publicNonce = user.nonce;

      verifier.verify({}, user.id, correctSignature, (error, entity) => {
        expect(error).to.equal(null);
        expect(entity).to.deep.equal(user);
        done();
      });
    });

    it('allows overriding of findBy', done => {
      verifier.options.findBy = 'email';

      user.email = 'admin@feathersjs.com';

      verifier.verify({}, 'admin@feathersjs.com', correctSignature, (error, entity) => {
        expect(error).to.equal(null);
        expect(entity).to.deep.equal(user);
        done();
      });
    });

    it('calls _normalizeResult', done => {
      sinon.spy(verifier, '_normalizeResult');
      verifier.verify({}, user.id, correctSignature, () => {
        expect(verifier._normalizeResult).to.have.been.calledOnce; // eslint-disable-line
        verifier._normalizeResult.restore();
        done();
      });
    });

    it('produces an error message when the user did not exist', done => {
      verifier.verify({}, 2, correctSignature, (err, user, info) => {
        expect(err).to.equal(null);
        expect(info.message).to.equal('Signature verification failed');
        done();
      });
    });

    it('calls _verifySignature', done => {
      sinon.spy(verifier, '_verifySignature');
      verifier.verify({}, user.id, correctSignature, () => {
        expect(verifier._verifySignature).to.have.been.calledOnce; // eslint-disable-line
        verifier._verifySignature.restore();
        done();
      });
    });

    it('returns the entity', done => {
      verifier.verify({}, user.id, correctSignature, (error, entity) => {
        expect(error).to.equal(null);
        expect(entity).to.deep.equal(user);
        done();
      });
    });

    it('handles false rejections in promise chain', (done) => {
      verifier._normalizeResult = () => Promise.reject(false); // eslint-disable-line
      verifier.verify({}, user.email, 'admin', (error, entity) => {
        expect(error).to.equal(null);
        expect(entity).to.equal(false);
        done();
      });
    });

    it('returns errors', (done) => {
      const authError = new Error('An error');
      verifier._normalizeResult = () => Promise.reject(authError);
      verifier.verify({}, user.email, 'admin', (error, entity) => {
        expect(error).to.equal(authError);
        expect(entity).to.equal(undefined);
        done();
      });
    });
  });

  describe('Verifier without service.id', function () {
    before(() => {
      service = {
        find () {}
      };
    });
  });
});

describe('Verifier without service.id', function () {
  let service;
  let app;
  let options;
  let verifier;

  beforeEach(() => {
    app = feathers();

    service = {
      find () {}
    };

    app.use('/users', service)
      .configure(authentication({ secret: 'supersecret' }));

    options = Object.assign({}, defaults, app.get('authentication'));

    verifier = new Verifier(app, options);
  });

  it('throws an error when service.id is not set', done => {
    verifier.verify({}, 'fakeId', 'fakeSignature', (error, entity) => {
      expect(error.message.includes('the `id` property must be set')).to.equal(true);
      expect(entity).to.equal(undefined);
      done();
    });
  });
});
