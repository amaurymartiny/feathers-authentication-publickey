# feathers-authentication-publickey Example

This provides a complete working example on how to use `feathers-authentication-publickey` to provide public key authentication and get a JWT access token in return.

1. Start the app by running `npm start`
2. Make a request using the authenticated user.

```bash
curl -H "Content-Type: application/json" -X POST -d '{"email":"admin@feathersjs.com","signature":"0x7db3ecd5e83bd5bab20a0664287a711707f60846d93b4604068b653ced903c7517f459f4706404524cd468795e2645a8a58ba893bbb77c120a8cab550227c2441b"}' http://localhost:3030/authentication
# The signature is the signature of the message "516958191" signed with the private key of 0xBf42a5519CD65416E743b7E52477288178469AEC
```
