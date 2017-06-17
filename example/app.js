const feathers = require('feathers');
const rest = require('feathers-rest');
const socketio = require('feathers-socketio');
const hooks = require('feathers-hooks');
const memory = require('feathers-memory');
const bodyParser = require('body-parser');
const errorHandler = require('feathers-errors/handler');
const auth = require('feathers-authentication');
const jwt = require('feathers-authentication-jwt');
const publicKey = require('../lib/index');

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
    findBy: 'email' // Replace here what you want to find the user by. This field must be in the request sent for the authentication.
  }))
  .configure(jwt())
  .use('/users', memory())
  .use(errorHandler());


// Authenticate the user using the default
// email/password strategy and if successful
// return a JWT.
app.service('authentication').hooks({
  before: {
    create: [
      auth.hooks.authenticate('publicKey')
    ]
  }
});

// Create a user that we can use to log in
const User = {
  email: 'admin@feathersjs.com',
  password: 'admin',
  publicKey: '0xBf42a5519CD65416E743b7E52477288178469AEC',
  nonce: 516958191, // Randomly generated number
  permissions: ['*']
};

app.service('users').create(User).then(user => {
  console.log('Created default user', user);
}).catch(console.error);

app.listen(3030);

console.log('Feathers authentication with publicKey auth started on 127.0.0.1:3030');
