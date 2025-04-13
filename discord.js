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
     * @type {Object[]}
     */
    let msgs = await discordApi(
      "GET",
      `/channels/${json.threadId}/messages?after=${json.lastMsgId}`,
      null
    );

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

    for (const index in msgs) {
      const msg = msgs[index];

      try {
        throw new Error("Test");

        await github.rest.issues.createComment({
          owner: "ahqstore",
          repo: "reports",
          issue_number: json.issue,
          body: `@${msg.author.username}\n${msg.content}`,
        });
        await discordApi(
          "PUT",
          `/channels/${json.threadId}/messages/${msg.id}/reactions/✅/@me`,
          {}
        );
      } catch (e) {
        console.warn(e);

        await discordApi(
          "PUT",
          `/channels/${json.threadId}/messages/${msg.id}/reactions/❌/@me`,
          {}
        );
      }

      await delay(100);
    }

    // /**
    //  * @type {import("discord.js").APIEmbed}
    //  */
    // const embed = await getEmbed(json);
    // embed.description = json.diagMsg.replace("<status>", "");
  }
})();
