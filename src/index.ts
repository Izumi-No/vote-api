import { HTTPException, Hono, MiddlewareHandler } from "hono";
import * as path from "std/path/mod.ts";
import "std/dotenv/load.ts";
import * as jose from "jose";
import { db } from "../persistence/kysely/connection.ts";
const ALG = "ES256";
import * as argon2 from "argon2";

interface Payload extends jose.JWTPayload {}

const privFile = Deno.readTextFileSync(
  path.join(Deno.cwd(), "keys/privateKey.jwk")
);
const pubFile = Deno.readTextFileSync(
  path.join(Deno.cwd(), "keys/publicKey.jwk")
);

const publicKey = await jose.importJWK(JSON.parse(pubFile), ALG);
const privateKey = await jose.importJWK(JSON.parse(privFile), ALG);

const PORT = Number(Deno.env.get("PORT")) || 3000;
const hono = new Hono();

const authMiddleware: MiddlewareHandler = async (ctx, next) => {
  const credentials = ctx.req.raw.headers.get("Authorization");
  let token;
  if (credentials) {
    const parts = credentials.split(/\s+/);
    if (parts.length !== 2) {
      const res = new Response("Unauthorized", {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer realm="${ctx.req.url}",error="invalid_request",error_description="invalid credentials structure"`,
        },
      });
      throw new HTTPException(401, { res });
    } else {
      token = parts[1];
    }
  }

  if (!token) {
    const res = new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer realm="${ctx.req.url}",error="invalid_request",error_description="no authorization included in request"`,
      },
    });
    throw new HTTPException(401, { res });
  }

  let payload;
  let msg = "";
  try {
    payload = await verifyJWT(token);
  } catch (e) {
    msg = `${e}`;
  }
  if (!payload) {
    const res = new Response("Unauthorized", {
      status: 401,
      statusText: msg,
      headers: {
        "WWW-Authenticate": `Bearer realm="${ctx.req.url}",error="invalid_token",error_description="token verification failure"`,
      },
    });
    throw new HTTPException(401, { res });
  }

  ctx.set("jwtPayload", payload);

  await next();
};

hono.post("/register", async (ctx) => {
  console.log("register");
  const { name, password } = await ctx.req.json();

  const passwordHash = await argon2.hash(password);
  const user = await db
    .insertInto("users")
    .values({
      id: globalThis.crypto.randomUUID(),
      name,
      password: passwordHash,
    })
    .returningAll()
    .executeTakeFirst();

  if (!user) {
    throw new HTTPException(500);
  }

  const jwt = await signJWT(user, user.id);
  return ctx.json({ jwt, user });
});

const apiRouter = new Hono();

hono.route("/api", apiRouter);

async function signJWT<T extends {}>(payload: T, subject?: string) {
  const signJWT = new jose.SignJWT(payload)
    .setExpirationTime("1h")
    .setProtectedHeader({
      alg: ALG,
    });

  if (subject) {
    signJWT.setSubject(subject);
  }
  return await signJWT.sign(privateKey);
}

async function verifyJWT(token: string) {
  return await jose.jwtVerify<Payload>(token, publicKey);
}

Deno.serve({ port: PORT }, hono.fetch);
