import { OAuthRequestError } from "@lucia-auth/oauth";
import { Elysia, t } from "elysia";
import { LuciaError } from "lucia";
import { parseCookie, serializeCookie } from "lucia/utils";
import { googleAuth } from "../auth";
import { config } from "../config";
import { ctx } from "../context";
import { redirect } from "../lib";

class DuplicateEmailError extends Error {
  constructor() {
    super("Duplicate email");
  }
}

export const authController = new Elysia({
  prefix: "/auth",
})
  .use(ctx)
  .get("/signout", async (ctx) => {
    const authRequest = ctx.auth.handleRequest(ctx);
    const session = await authRequest.validate();

    if (!session) {
      redirect(
        {
          set: ctx.set,
          headers: ctx.headers,
        },
        "/",
      );
      return;
    }

    await ctx.auth.invalidateSession(session.sessionId);

    const sessionCookie = ctx.auth.createSessionCookie(null);

    ctx.set.headers["Set-Cookie"] = sessionCookie.serialize();
    redirect(
      {
        set: ctx.set,
        headers: ctx.headers,
      },
      "/",
    );
  })
  .get("/login/google", async ({ set }) => {
    const [url, state] = await googleAuth.getAuthorizationUrl();

    const state_cookie = serializeCookie("google_auth_state", state, {
      maxAge: 60 * 60,
      httpOnly: true,
      secure: config.env.NODE_ENV === "production",
      path: "/",
    });

    set.headers["Set-Cookie"] = state_cookie;

    set.redirect = url.toString();
  })
  .get("/google/callback", async ({ set, query, headers, auth, log }) => {
    const { state, code } = query;

    const cookies = parseCookie(headers["cookie"] || "");
    const state_cookie = cookies["google_auth_state"];

    if (!state_cookie || !state || state_cookie !== state || !code) {
      set.status = "Unauthorized";
      console.log("Aloha!: ", { state_cookie, state, code });
      return;
    }

    try {
      const { createUser, getExistingUser, googleUser } =
        await googleAuth.validateCallback(code);
      const getUser = async () => {
        const existingUser = await getExistingUser();

        if (existingUser) {
          return existingUser;
        }

        const user = await createUser({
          attributes: {
            name: googleUser.name,
            picture: googleUser.picture,
            email: googleUser.email ?? null,
          },
        });

        return user;
      };

      const user = await getUser();
      const session = await auth.createSession({
        userId: user.userId,
        attributes: {},
      });
      const sessionCookie = auth.createSessionCookie(session);

      set.headers["Set-Cookie"] = sessionCookie.serialize();
      redirect(
        {
          set,
          headers,
        },
        "/new-user",
      );
    } catch (e) {
      log.error(e, "Error signing in with Google");
      if (e instanceof OAuthRequestError) {
        set.status = "Unauthorized";
        return;
      } else {
        set.status = "Internal Server Error";
        return;
      }
    }
  });
