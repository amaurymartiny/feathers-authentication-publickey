# feathers-authentication-publickey

> Public Key authentication strategy for feathers-authentication using Passport without all the boilerplate.

The Public Key used in this repo is a Ethereum public key. The encryption and signature verification are done using [web3](https://github.com/ethereum/web3.js) and [ethereumjs-util](https://github.com/ethereumjs/ethereumjs-util). You can of course use any Public Key and signature verification algorithm want (see Customizing the Verifier).

## Installation

```
npm install feathers-authentication-publickey --save
```

**Note:** This is only compatibile with `feathers-authentication@1.x` and above.

## Documentation

## API

This module contains 2 core pieces:

1. The main entry function
3. The `Verifier` class

### Main Initialization

In most cases initializing the `feathers-authentication-publickey` module is as simple as doing this:

```js
app.configure(authentication(settings));
app.configure(publicKey());
```

This will pull from your global `auth` object in your config file. It will also mix in the following defaults, which can be customized.

#### Default Options

```js
{
    name: 'publicKey', // the name to use when invoking the authentication Strategy
    entity: 'user', // the entity that you're comparing username/password against
    service: 'users', // the service to look up the entity
    in: 'body', // does the data lie in req.body or req.headers?
    findBy: 'id', // field to uniquely find the user in the database. This field should be present in the request
    publicKeyField: 'publicKey', // Field in the entity model for publicKey
    nonceField: 'nonce', // Field in the entity model for nonce
    session: false // whether to use sessions
    passReqToCallback: true, // whether the request object should be passed to `verify`
    Verifier: Verifier // A Verifier class. Defaults to the built-in one but can be a custom one. See below for details.
}
```

### Verifier

This is the verification class that does the signature verification by looking up the entity (normally a `user`) on a given service by the `findBy` and compares public address.

It now uses Ethereum public key, and the `ecrecover` tool from `ethereumjs-util` to verify the signature.

It has the following methods that can all be overridden. All methods return a promise except `verify`, which has the exact same signature as [passport-publickey](https://github.com/amaurymartiny/passport-publickey).

```js
{
    constructor(app, options) // the class constructor
    _verifySignature(entity, signature) // verifies signature using ecrecover
    _normalizeResult(result) // normalizes result from service to account for pagination
    verify(req, findByValue, signature, done) // queries the service and calls the other internal functions.
}
```


#### Customizing the Verifier

The `Verifier` class can be extended so that you customize it's behavior without having to rewrite and test a totally custom publickey Passport implementation. Although that is always an option if you don't want use this plugin.

An example of customizing the Verifier:

```js
import publickey, { Verifier } from 'feathers-authentication-publickey';

class CustomVerifier extends Verifier {
  // The verify function has the exact same inputs and 
  // return values as a vanilla passport strategy
  verify(req, username, password, done) {
    // do your custom stuff. You can call internal Verifier methods
    // and reference this.app and this.options. This method must be implemented.

    // the 'user' variable can be any truthy value
    done(null, user);
  }
}

app.configure(publickey({ Verifier: CustomVerifier }));
```

## Expected Request Data
By default, this strategy expects a payload in this format (if `findBy` has been set to 'email'). Replace 'email'
by the value of findBy.

```js
{
  strategy: 'publicKey',
  email: '<email>', // or nonce: '<nonce>', or some other field defined by findBy
  signature: '<long_token>'
}
```

## Complete Example

Here's a basic example of a Feathers server that uses `feathers-authentication-publickey`. You can see a fully working example in the [example/](./example/) directory.

```js
const feathers = require('feathers');
const rest = require('feathers-rest');
const socketio = require('feathers-socketio');
const hooks = require('feathers-hooks');
const memory = require('feathers-memory');
const bodyParser = require('body-parser');
const errorHandler = require('feathers-errors/handler');
const auth = require('feathers-authentication');
const jwt = require('feathers-authentication-jwt');
const publicKey = require('feathers-authentication-publickey');

// Initialize the application
const app = feathers();

app.configure(rest())
  .configure(socketio())
  .configure(hooks())
  // Needed for parsing bodies (login)
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }))
  // Configure feathers-authentication
  .configure(auth({ secret: 'super secret' }))
  .configure(publicKey({
    findBy: 'email', // Replace here what you want to find the user by. This field must be in the request body
    in: 'body'
  }))
  .configure(jwt())
  .use('/users', memory())
  .use(errorHandler());

app.listen(3030);

console.log('Feathers app started on 127.0.0.1:3030');
```

## License

Copyright (c) 2016

Licensed under the [MIT license](LICENSE).
