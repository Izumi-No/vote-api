import { HTTPException, Hono, MiddlewareHandler } from "hono";
import * as path from "std/path/mod.ts";
import "std/dotenv/load.ts";
import * as jose from "jose";
import { db } from "../persistence/kysely/connection.ts";
const ALG = "ES256";
import * as argon2 from "argon2";

interface Payload extends jose.JWTPayload {
  id: string;
  name: string;
  password: string;
}

const privFile = Deno.readTextFileSync(
  path.join(Deno.cwd(), "keys/privateKey.jwk")
);
const pubFile = Deno.readTextFileSync(
  path.join(Deno.cwd(), "keys/publicKey.jwk")
);

const publicKey = await jose.importJWK(JSON.parse(pubFile), ALG);
const privateKey = await jose.importJWK(JSON.parse(privFile), ALG);

type Variables = {
  jwtPayload: Payload;
};

const PORT = Number(Deno.env.get("PORT")) || 3000;
const hono = new Hono();

const authMiddleware: MiddlewareHandler = async (ctx, next) => {
  //   const credentials = ctx.req.raw.headers.get("Authorization");
  //   let token;
  //   if (credentials) {
  //     const parts = credentials.split(/\s+/);
  //     if (parts.length !== 2) {
  //       const res = new Response("Unauthorized", {
  //         status: 401,
  //         headers: {
  //           "WWW-Authenticate": `Bearer realm="${ctx.req.url}",error="invalid_request",error_description="invalid credentials structure"`,
  //         },
  //       });
  //       throw new HTTPException(401, { res });
  //     } else {
  //       token = parts[1];
  //     }
  //   }

  //   if (!token) {
  //     const res = new Response("Unauthorized", {
  //       status: 401,
  //       headers: {
  //         "WWW-Authenticate": `Bearer realm="${ctx.req.url}",error="invalid_request",error_description="no authorization included in request"`,
  //       },
  //     });
  //     throw new HTTPException(401, { res });
  //   }

  //   let payload;
  //   let msg = "";
  //   try {
  //     payload = await verifyJWT(token);
  //   } catch (e) {
  //     msg = `${e}`;
  //   }
  //   if (!payload) {
  //     const res = new Response("Unauthorized", {
  //       status: 401,
  //       statusText: msg,
  //       headers: {
  //         "WWW-Authenticate": `Bearer realm="${ctx.req.url}",error="invalid_token",error_description="token verification failure"`,
  //       },
  //     });
  //     throw new HTTPException(401, { res });
  //   }

  //   ctx.set("jwtPayload", payload);

  //   await next();
  const credentials = ctx.req.raw.headers.get("Authorization");

  if (!credentials) {
    throw new HTTPException(401);
  }

  const [_, token] = credentials.split(" ");

  if (!token) {
    throw new HTTPException(401);
  }

  const payload = (await verifyJWT(token)).payload;

  if (!payload) {
    throw new HTTPException(401);
  }

  ctx.set("jwtPayload", payload);
  return await next();
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

hono.post("/login", async (ctx) => {
  const { name, password } = await ctx.req.json();

  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("name", "=", name)
    .executeTakeFirst();

  if (!user) {
    throw new HTTPException(401);
  }

  const valid = await argon2.verify(user.password, password);
  if (!valid) {
    throw new HTTPException(401);
  }

  const jwt = await signJWT(user, user.id);
  return ctx.json({ jwt, user });
});

const apiRouter = new Hono<{
  Variables: Variables;
}>();

apiRouter.use("/*", authMiddleware);

apiRouter.post("/vote", async (ctx) => {
  const { voting: votingId } = ctx.req.query();
  const { participant: participantId } = await ctx.req.json();
  const payload = ctx.get("jwtPayload");

  console.log("participant: participantId", participantId);

  const userId = payload.id;
  console.log("payload", payload);

  const voting = await db
    .selectFrom("votings")
    .selectAll()
    .where("id", "=", votingId)
    .where("open", "=", true)
    .executeTakeFirst();

  console.log("voting", voting);

  if (!voting) {
    throw new HTTPException(404);
  }

  const participant = await db
    .selectFrom("participants")
    .selectAll()
    .where("id", "=", participantId)
    .executeTakeFirst();

  console.log("participant", participant);

  if (!participant) {
    throw new HTTPException(404);
  }

  let vote = await db
    .selectFrom("votes")
    .selectAll()
    .where("user_id", "=", userId)
    .where("voting_id", "=", votingId)
    .executeTakeFirst();

  if (vote) {
    throw new HTTPException(409);
  } else {
    vote = await db.transaction().execute(async (trx) => {
      const vote = await trx
        .insertInto("votes")
        .values({
          id: globalThis.crypto.randomUUID(),
          user_id: userId,
          voting_id: votingId,
          participant_id: participantId,
        })
        .returningAll()
        .executeTakeFirst();

      if (!vote) {
        throw new HTTPException(500);
      }

      let result = await trx
        .selectFrom("results")
        .selectAll()
        .where("voting_id", "=", votingId)
        .where("participant_id", "=", participantId)
        .executeTakeFirst();

      if (!result) {
        result = await trx
          .insertInto("results")
          .values({
            id: globalThis.crypto.randomUUID(),
            voting_id: votingId,
            participant_id: participantId,
            count: 1,
          })
          .returningAll()
          .executeTakeFirst();
      } else {
        result = await trx
          .updateTable("results")
          .set({ count: result.count + 1 })
          .where("id", "=", result.id)
          .returningAll()
          .executeTakeFirst();
      }

      return vote;
    });
  }

  return ctx.json({ vote });
});

apiRouter.get("/results", async (ctx) => {
  const { voting: votingId, participant: participantId } = ctx.req.query();

  const results = await db
    .selectFrom("results")
    .selectAll()
    .where("voting_id", "=", votingId)
    .where("participant_id", "=", participantId)
    .executeTakeFirst();

  return ctx.json({ results });
});

apiRouter.get("/votings", async (ctx) => {
  const votings = await db
    .selectFrom("votings")
    .selectAll()
    .where("open", "=", true)
    .execute();

  return ctx.json({ votings });
});

apiRouter.post("/votings", async (ctx) => {
  const { initDate, endDate } = await ctx.req.json();

  const voting = await db
    .insertInto("votings")
    .values({
      id: globalThis.crypto.randomUUID(),
      init_date: new Date(initDate * 1000),
      end_date: new Date(endDate * 1000),
      open: true,
    })
    .returningAll()
    .executeTakeFirst();

  if (!voting) {
    throw new HTTPException(500);
  }

  return ctx.json({ voting });
});

apiRouter.post("/participants", async (ctx) => {
  const { name } = await ctx.req.json();

  const participant = await db
    .insertInto("participants")
    .values({
      id: globalThis.crypto.randomUUID(),
      name,
    })
    .returningAll()
    .executeTakeFirst();

  if (!participant) {
    throw new HTTPException(500);
  }

  return ctx.json({ participant });
});

apiRouter.get("/participants", async (ctx) => {
  const participants = await db
    .selectFrom("participants")
    .selectAll()
    .execute();

  return ctx.json({ participants });
});

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
  try {
    return await jose.jwtVerify<Payload>(token, publicKey);
  } catch (e) {
    throw e;
  }
}

Deno.serve({ port: PORT }, hono.fetch);
