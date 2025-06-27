const { existsSync } = require("fs");
const discordApi = require("./src/discordApi");

/**
 * @type {any}
 */
const event = require("./event.json");

(async () => {
  const report = existsSync(`./database/report_${event.issue.number}`);

  if (report) {
    /**
     * @type {{
     *  msg: string;
     *  issue: number;
     *  issueTitle?: string;
     *  timestamp: number;
     *  threadId: string;
     *  lastMsgId: string;
     *  diagMsg: string;
     *  lastUpdate: number;
     *  oldEmbed?: Object;
     * }}
     */
    const json = require(`./database/report_${event.issue.number}`);

    /**
     * @type {string}
     */
    const webhook = process.env.WEBHOOK || "";

    await discordApi(
      "POST",
      `${webhook}?wait=true&thread_id=${json.threadId}`,
      {
        content: event.comment.body,
        username: event.comment.user.login,
        avatar_url: event.comment.user.avatar_url,
      }
    );
  }
})();
