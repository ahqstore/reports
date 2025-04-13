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

    const msgs = await discordApi(
      "GET",
      `/channels/${json.threadId}/messages?after=${json.lastMsgId}&limit=100`,
      null
    );

    console.log(json.msg, msgs);

    // /**
    //  * @type {import("discord.js").APIEmbed}
    //  */
    // const embed = await getEmbed(json);
    // embed.description = json.diagMsg.replace("<status>", "");

    console.log(json);
  }
})();
