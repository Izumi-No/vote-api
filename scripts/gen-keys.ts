import * as jose from "jose";

const { privateKey: privKey, publicKey: pubKey } = await jose.generateKeyPair(
  "ES256",
  { extractable: true }
);

const privjwk = await jose.exportJWK(privKey);
const pubjwk = await jose.exportJWK(pubKey);

const privateKey = await jose.exportPKCS8(privKey);
const publicKey = await jose.exportSPKI(pubKey);

Deno.writeTextFileSync("./keys/privateKey.pem", privateKey);
Deno.writeTextFileSync("./keys/publicKey.pem", publicKey);
Deno.writeTextFileSync("./keys/privateKey.jwk", JSON.stringify(privjwk));
Deno.writeTextFileSync("./keys/publicKey.jwk", JSON.stringify(pubjwk));
