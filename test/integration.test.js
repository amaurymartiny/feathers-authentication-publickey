import feathers from 'feathers';
import authentication from 'feathers-authentication';
import memory from 'feathers-memory';
import hooks from 'feathers-hooks';
import publicKey from '../src';
import { expect } from 'chai';

describe('integration', () => {
  it('verifies', () => {
    const User = {
      publicKey: '0x0b664ebf14e204cde96690461830e0dd5dfb22aa',
      nonce: 100
    };

    // Message '100' signed by 0x0b664ebf14e204cde96690461830e0dd5dfb22aa: web3.eth.sign('0x0b664ebf14e204cde96690461830e0dd5dfb22aa', '100');
    const correctSignature =
      '0x44f4a9195e3df7bdd323640098d976b194e6bfb834b3b1c51a4142d5b185463653f781fb2a836fa738f8ce554eaa5a222193063375728fc6424443d8bcae6c4b1c';

    const req = {
      query: {},
      body: {
        id: 0,
        signature: correctSignature
      },
      headers: {},
      cookies: {},
      params: {
        query: {},
        provider: 'socketio',
        headers: {},
        session: {},
        cookies: {},
        data: 'Hello, world'
      }
    };

    const app = feathers();
    let paramsReceived = false;
    let dataReceived;

    app
      .configure(hooks())
      .configure(authentication({ secret: 'secret' }))
      .configure(publicKey())
      .use('/users', memory());

    app.service('users').hooks({
      before: {
        find: hook => {
          paramsReceived = Object.keys(hook.params);
          dataReceived = hook.params.data;
        }
      }
    });

    app.setup();

    return app
      .service('users')
      .create(User)
      .then(response => {
        return app
          .authenticate('publicKey')(req)
          .then(result => {
            expect(result.success).to.equal(true);
            expect(result.data.user.publicKey).to.equal(User.publicKey);
            expect(result.data.user.nonce).to.equal(100);
            expect(paramsReceived).to.have.members(['data', 'query']);
            expect(dataReceived).to.equal('Hello, world');
          });
      });
  });
});
