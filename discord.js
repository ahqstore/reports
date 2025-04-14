// @ts-check

const { EmbedBuilder } = require("discord.js");
const { readdirSync, writeFileSync } = require("fs");
const discordApi = require("./src/discordApi");

const statusRegex = /^@(progress|unplanned|false|resolved)$/;

/**
 *
 * @param {{ msg: string, oldEmbed?: Object }} data
 * @returns {Promise<Object>}
 */
const getEmbed = async (data) => {
  if (data.oldEmbed) {
    return data.oldEmbed;
  }

  return (
    await discordApi(
      "GET",
      `/channels/1360259132439007281/messages/${data.msg}`,
      null
    )
  ).embeds[0];
};

(async () => {
  const { Octokit } = await import("@octokit/rest");
  const github = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    userAgent: "AHQ Store Issues Bot",
  });

  writeFileSync("./lastrun", Date.now().toString());

  const reports = readdirSync("./database").filter((s) => s != ".gitkeep");

  for (const index in reports) {
    const report = reports[index];

    /**
     * @type {{
     *  msg: string;
     *  issue: number;
     *  timestamp: number;
     *  threadId: string;
     *  lastMsgId: string;
     *  diagMsg: string;
     *  lastUpdate: number;
     *  oldEmbed?: Object;
     * }}
     */
    const json = require(`./database/${report}`);

    /**
     *
     * @param {string} content
     * @returns {{ content: string, postSendMsg: (j: typeof json) => Promise<boolean> }}
     */
    const normalizeContent = (content) => {
      const splits = content.split("\n").map((x) => x.trim());

      const first = splits[0];

      /**
       * @type {"progress" | "unplanned" | "false" | "resolved" | undefined}
       */
      let typ = undefined;

      if (statusRegex.test(first)) {
        const exec = statusRegex.exec(first) || [];

        if (exec.length > 0) {
          // @ts-ignore
          typ = exec[1];
        }
      }

      return {
        content: (() => {
          if (typ) {
            return splits.slice(1).join("\n");
          }

          return content;
        })(),
        postSendMsg: async (json) => {
          if (typ) {
            const embed = await getEmbed(json);

            /**
             * @type {{
             *  [key in "false" | "progress" | "unplanned" | "resolved"]: {
             *    state?: "closed" | "open",
             *    state_reason?: "not_planned" | "completed",
             *    labels: string[] | undefined,
             *    embedBody: string
             *  }
             * }}
             */
            const updateMap = {
              false: {
                state: "closed",
                state_reason: "not_planned",
                labels: ["false positive"],
                embedBody: json.diagMsg.replace(
                  "<status>",
                  "🚫 False Positive"
                ),
              },
              progress: {
                state: "open",
                labels: ["in progress"],
                embedBody: json.diagMsg.replace(
                  "<status>",
                  "🩹 Remedy in Progress"
                ),
              },
              unplanned: {
                state: "closed",
                state_reason: "not_planned",
                labels: ["unplanned"],
                embedBody: json.diagMsg.replace("<status>", "❌ Unplanned"),
              },
              resolved: {
                state: "closed",
                state_reason: "completed",
                labels: ["resolved"],
                embedBody: json.diagMsg.replace("<status>", "✅ Resolved"),
              },
            };

            const { embedBody, labels, state, state_reason } = updateMap[typ];

            await github.rest.issues.update({
              owner: "ahqstore",
              repo: "reports",
              issue_number: json.issue,
              state,
              state_reason,
              labels,
            });

            await discordApi(
              "PATCH",
              `${process.env["WEBHOOK"]}/messages/${json.msg}`,
              {
                embeds: [
                  {
                    ...embed,
                    description: embedBody,
                  },
                ],
              }
            );

            return state == "closed";
          }

          return false;
        },
      };
    };

    /**
     * @type {Object[]}
     */
    let msgs = await discordApi(
      "GET",
      `/channels/${json.threadId}/messages?after=${json.lastMsgId}`,
      null
    );

    if (!Array.isArray(msgs)) {
      continue;
    }

    msgs.reverse();

    msgs = msgs
      .map((x) => {
        const sterilize = /<(@|#)[!&0-9a-zA-Z]*> ?/g;

        return {
          ...x,
          content: x.content.replace(sterilize, ""),
        };
      })
      .filter((s) => !s?.author?.bot && s.content.trim().length != 0);

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    if (msgs.length > 0) {
      json.lastMsgId = msgs[msgs.length - 1].id;
      json.lastUpdate = Date.now();
    }

    let closed = false;

    for (const index in msgs) {
      const msg = msgs[index];

      try {
        const body = normalizeContent(msg.content);

        await github.rest.issues.createComment({
          owner: "ahqstore",
          repo: "reports",
          issue_number: json.issue,
          body: `@${msg.author.username} says:\n\n${body.content}`,
        });
        await discordApi(
          "PUT",
          `/channels/${json.threadId}/messages/${msg.id}/reactions/📩/@me`,
          {}
        );

        closed = closed || (await body.postSendMsg(json));
      } catch (e) {
        console.warn(e);

        await discordApi(
          "PUT",
          `/channels/${json.threadId}/messages/${msg.id}/reactions/❌/@me`,
          {}
        );
      }

      if (closed) {
        // We'll do stuff later
      } else {
        writeFileSync(`./database/${report}`, JSON.stringify(json, null, 2));
      }

      await delay(50);
    }

    // /**
    //  * @type {import("discord.js").APIEmbed}
    //  */
    // const embed = await getEmbed(json);
    // embed.description = json.diagMsg.replace("<status>", "");
  }
})();
