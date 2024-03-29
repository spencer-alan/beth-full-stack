import Elysia from "elysia";
import { BaseHtml } from "../components/base";
import { ctx } from "../context";
import { redirect } from "../lib";

export const newUser = new Elysia()
  .use(ctx)
  .get("/new-user", async ({ html, session, set, headers }) => {
    if (!session) {
      redirect(
        {
          set,
          headers,
        },
        "/login",
      );
      return;
    }
    return html(() => (
      <BaseHtml>
        <div safe>Hi new user {session.user.name}</div>
        <p>Do you want to join or create an organization?</p>
      </BaseHtml>
    ));
  });
