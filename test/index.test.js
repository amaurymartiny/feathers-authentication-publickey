import feathers from 'feathers';
import memory from 'feathers-memory';
import authentication from 'feathers-authentication';
import publicKey, { Verifier } from '../src';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import passportPublicKey from 'passport-publickey';

chai.use(sinonChai);

describe('feathers-authentication-publickey', () => {
  it('is CommonJS compatible', () => {
    expect(typeof require('../lib')).to.equal('function');
  });

  it('basic functionality', () => {
    expect(typeof publicKey).to.equal('function');
  });

  it('exposes hooks', () => {
    expect(typeof publicKey.hooks).to.equal('object');
  });

  it('exposes the Verifier class', () => {
    expect(typeof Verifier).to.equal('function');
    expect(typeof publicKey.Verifier).to.equal('function');
  });

  describe('initialization', () => {
    let app;

    beforeEach(() => {
      app = feathers();
      app.use('/users', memory());
      app.configure(authentication({ secret: 'supersecret' }));
    });

    it('throws an error if passport has not been registered', () => {
      expect(() => {
        feathers().configure(publicKey());
      }).to.throw();
    });

    it('registers the publicKey passport strategy', () => {
      sinon.spy(app.passport, 'use');
      sinon.spy(passportPublicKey, 'Strategy');
      app.configure(publicKey());
      app.setup();

      expect(passportPublicKey.Strategy).to.have.been.calledOnce; // eslint-disable-line
      expect(app.passport.use).to.have.been.calledWith('publicKey');

      app.passport.use.restore();
      passportPublicKey.Strategy.restore();
    });

    it('registers the strategy options', () => {
      sinon.spy(app.passport, 'options');
      app.configure(publicKey());
      app.setup();

      expect(app.passport.options).to.have.been.calledOnce; // eslint-disable-line

      app.passport.options.restore();
    });

    describe('passport strategy options', () => {
      let authOptions;
      let args;

      beforeEach(() => {
        sinon.spy(passportPublicKey, 'Strategy');
        app.configure(publicKey({ custom: true }));
        app.setup();
        authOptions = app.get('authentication');
        args = passportPublicKey.Strategy.getCall(0).args[0];
      });

      afterEach(() => {
        passportPublicKey.Strategy.restore();
      });

      it('sets findBy', () => {
        expect(args.findBy).to.equal('id');
      });

      it('sets in', () => {
        expect(args.in).to.equal('body');
      });

      it('sets publicKeyField', () => {
        expect(args.publicKeyField).to.equal('publicKey');
      });

      it('sets nonceField', () => {
        expect(args.nonceField).to.equal('nonce');
      });

      it('sets entity', () => {
        expect(args.entity).to.equal(authOptions.entity);
      });

      it('sets service', () => {
        expect(args.service).to.equal(authOptions.service);
      });

      it('sets session', () => {
        expect(args.session).to.equal(authOptions.session);
      });

      it('sets passReqToCallback', () => {
        expect(args.passReqToCallback).to.equal(authOptions.passReqToCallback);
      });

      it('supports setting custom options', () => {
        expect(args.custom).to.equal(true);
      });
    });

    it('supports overriding default options', () => {
      sinon.spy(passportPublicKey, 'Strategy');
      app.configure(publicKey({ usernameField: 'username' }));
      app.setup();

      // expect(passportPublicKey.Strategy.getCall(0).args[0].usernameField).to.equal('username');

      passportPublicKey.Strategy.restore();
    });

    it('pulls options from global config', () => {
      sinon.spy(passportPublicKey, 'Strategy');
      let authOptions = app.get('authentication');
      authOptions.publicKey = { findBy: 'email' };
      app.set('authentication', authOptions);

      app.configure(publicKey());
      app.setup();

      expect(passportPublicKey.Strategy.getCall(0).args[0].findBy).to.equal('email');
      expect(passportPublicKey.Strategy.getCall(0).args[0].publicKeyField).to.equal('publicKey');

      passportPublicKey.Strategy.restore();
    });

    it('pulls options from global config with custom name', () => {
      sinon.spy(passportPublicKey, 'Strategy');
      let authOptions = app.get('authentication');
      authOptions.custom = { findBy: 'email' };
      app.set('authentication', authOptions);

      app.configure(publicKey({ name: 'custom' }));
      app.setup();

      expect(passportPublicKey.Strategy.getCall(0).args[0].findBy).to.equal('email');
      expect(passportPublicKey.Strategy.getCall(0).args[0].publicKeyField).to.equal('publicKey');

      passportPublicKey.Strategy.restore();
    });

    describe('custom Verifier', () => {
      it('throws an error if a verify function is missing', () => {
        expect(() => {
          class CustomVerifier {
            constructor (app) {
              this.app = app;
            }
          }
          app.configure(publicKey({ Verifier: CustomVerifier }));
          app.setup();
        }).to.throw();
      });

      it('verifies through custom verify function', () => {
        const User = {
          id: 1,
          publicKey: '0x123'
        };

        const correctSignature = 'correct_signature';

        const req = {
          query: {},
          body: {
            id: 1,
            signature: correctSignature
          },
          headers: {},
          cookies: {}
        };
        class CustomVerifier extends Verifier {
          verify (req, id, signature, done) {
            expect(id).to.equal(User.id);
            expect(signature).to.equal(correctSignature);
            done(null, User);
          }
        }

        app.configure(publicKey({ Verifier: CustomVerifier }));
        app.setup();

        return app.authenticate('publicKey')(req).then(result => {
          expect(result.data.user).to.deep.equal(User);
        });
      });
    });
  });
});
