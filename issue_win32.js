// @ts-check

const { resolve } = require("path");
const scanWindows = require("./src/scanWindows");
const { readdirSync, mkdirSync, writeFileSync } = require("fs");

/**
 * @type {any}
 */
const event = require("./event.json");
const { EmbedBuilder } = require("discord.js");
const downloadFiles = require("./src/downloadFiles");
const checkAppId = require("./src/checkAppId");
const discordApi = require("./src/discordApi");

const owner = "ahqstore";
const repo = "reports";

(async () => {
  const { Octokit } = await import("@octokit/rest");
  const github = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    userAgent: "AHQ Store Issues Bot",
  });

  /**
   * @type {string}
   */
  const body = event.issue.body || "";

  /**
   * @type {string}
   */
  const username = event.issue.user.login || "";

  /**
   * @type {number}
   */
  const number = event.issue.number;

  const bodyRegex = /---ISSUE---\n([\s\S]*?)\n---END---/;

  const prsed = bodyRegex.exec(body)?.at(1) || "<impossible>";

  const bodyParsed = (() => {
    try {
      return JSON.parse(prsed);
    } catch (_) {
      return "<impossible>";
    }
  })();

  const otherBody = body
    .replace(prsed, "")
    .replace("---ISSUE---", "")
    .replace("---END---", "");

  mkdirSync("./infected");

  const app = await checkAppId(github, bodyParsed.appId, number);
  if (typeof app == "boolean" && app == false) return;

  const win32 = await scanWindowsDefender(app.urls);

  /**
   * @type {{
   *  clamav: {
   *   goodFiles: string[],
   *   badFiles: string[],
   *   isInfected: boolean,
   *   viruses: string[]
   *  },
   *  number: number
   * }}
   */
  const {
    clamav: { goodFiles, badFiles, isInfected, viruses },
    number: commentNumber,
  } = require("./oldscan.json");

  // @formatter:off
  // prettier-ignore
  const stats = `# ClamAV

  | Statistics     |                                                               |
  | -------------- | ------------------------------------------------------------- |
  | Total Files    | ${badFiles.length + goodFiles.length}                         |
  | Total Infected | **${badFiles.length}**/${badFiles.length + goodFiles.length}  |
  | Viruses        | **${viruses.join(", ")}**                                     |
  | Infected       | **${isInfected ? "⚠️ Yes" : "✅ No"}**                        |
  
  # Windows Defender

  | Statistics     |                                                                                 |
  | -------------- | ------------------------------------------------------------------------------- |
  | Total Scanned  | ${win32.badFiles.length + win32.goodFiles.length}/${win32.total}                |
  | Total Infected | **${win32.badFiles.length}**/${win32.badFiles.length + win32.goodFiles.length}  |
  | Total Skipped  | **${win32.skipped.length}**                                                     |
  | Infected       | **${win32.isInfected ? "⚠️ Yes" : "✅ No"}**                                    |

  ${win32.viruses.length == 0 ? "" : `## Windows Defender Viruses
    \`\`\`
    ${win32.viruses.join("\n")}
    \`\`\``}
 
 *This issue is now being transferred to our **Moderation Team***`;

  try {
    const data = {
      win32,
      oldscan: require("./oldscan.json"),
    };

    console.log(data);

    await github.rest.issues.updateComment({
      comment_id: commentNumber,
      owner,
      repo,
      body: JSON.stringify(data, null, 2),
    });
  } catch (e) {
    console.warn(e);
  }

  await github.rest.issues.updateComment({
    comment_id: commentNumber,
    owner,
    repo,
    body: stats,
  });

  await github.rest.issues.update({
    owner,
    repo,
    issue_number: number,
    labels: ["investigating"],
  });

  // prettier-ignore
  const diag = `Report for ${app.data.appDisplayName} (${app.data.appId})

  **Current Status:** <status>

  **Reported by:** \`@${username}\`
  **OS:** ${bodyParsed.os || "Unknown"}

  ## Application Details
  > **App Name:** ${app.data.appDisplayName}
  > **App ID:** ${app.data.appId}
  > **App Version:** ${app.data.verified}
  > **Author:** ${app.data.authorId}
  > **Repository:** https://github.com/${app.data.repo.author}/${app.data.repo.repo}
  
  ## ClamAV Report
  > **Total Files**:    ${badFiles.length + goodFiles.length}                         
  > **Total Infected**: **${badFiles.length}**/${badFiles.length + goodFiles.length}  
  > **Viruses**:        **${viruses.join(", ")}**                                     
  > **Infected**:       **${isInfected ? "⚠️ Yes" : "✅ No"}**  

  ## Windows Defender Report
  > **Total Files**:    ${win32.badFiles.length + win32.goodFiles.length}/${win32.total}                         
  > **Total Infected**: **${win32.badFiles.length}**/${win32.badFiles.length + win32.goodFiles.length}
  > **Total Skipped**:  **${win32.skipped.length}**
  > **Infected**:       **${win32.isInfected ? "⚠️ Yes" : "✅ No"}**
  ${win32.viruses.length == 0 ? "" : `\n## Windows Defender Viruses
  \`\`\`
  ${win32.viruses.join("\n")}
  \`\`\``}
  
  **Linked GitHub Issue:** https://github.com/ahqstore/reports/issues/${number}

  ${otherBody.trim().substring(0, 1000)}${otherBody.length > 1000 ? "..." : ""}
`.split("\n").map((x) => x.trim()).join("\n");

  // prettier-ignore
  const embed = new EmbedBuilder()
    .setTitle(`Severity: ${!(isInfected || win32.isInfected) ? "⚒️ Low" : "⚠️ Severe"}`)
    .setURL(`https://github.com/ahqstore/reports/issues/${number}`)
    .setFooter({
      text: `Reference Issue Number: ${number}`,
      iconURL: "https://github.com/ahqstore.png",
    })
    .setColor(isInfected ? "Red" : "Yellow")
    .setDescription(
      diag.replace("<status>", "🔍 Investigating")
    )
    .toJSON();

  /**
   * @type {string}
   */
  const webhook = process.env.WEBHOOK || "";

  const msg = await discordApi("POST", `${webhook}?wait=true`, {
    content:
      isInfected || win32.isInfected
        ? `<@&1245401644733169724> <@&1142141595555205190>`
        : `New Report`,
    embeds: [embed],
  });

  console.log(msg);

  const data = await discordApi(
    "POST",
    `/channels/${msg.channel_id}/messages/${msg.id}/threads`,
    {
      name: "Logs & Comments",
    }
  );

  console.log(data);

  const threadMsg = await discordApi("POST", `/channels/${data.id}/messages`, {
    content:
      `👋🏼 Hello Review Team! I am **AHQ Store Bot**. Every message in this thread will _eventually_ be transferred to the linked GitHub issue.
    
    You can annotate your messages with the following tags (the tags **might** be used in the 1st line of the message)

    @ignore
    > The message will not be sent to GitHub

    @progress
    > This sends a specialized \`in-progress\` message in the GitHub Issue
    > Also edits the message with the status \`🩹 Remedy in Progress\`

    @unplanned
    > This closes the related GitHub issue as \`unplanned\`
    > Edits the message with the status \`❌ Unplanned\`

    @false
    > This closes the related GitHub issue as \`false positive\`
    > Edits the message with the status \`🚫 False Positive\`

    @resolve
    > This closes the related GitHub issue as \`resolved\`
    > Edits the message with the status \`✅ Resolved\`
    `
        .split("\n")
        .map((x) => x.trim())
        .join("\n"),
  });

  console.log(threadMsg);

  writeFileSync(
    `./database/report_${number}.json`,
    JSON.stringify(
      {
        msg: msg.id,
        issue: number,
        timestamp: Date.now(),
        threadId: data.id,
        lastMsgId: threadMsg.id,
        diagMsg: diag,
        lastUpdate: Date.now(),
        oldEmbed: embed,
      },
      null,
      2
    )
  );
})();

/**
 *
 * @param {{
 *  url: string;
 * file: string;
 * }[]} file
 * @returns {Promise<{
 *  isInfected: boolean,
 *  goodFiles: string[],
 *  badFiles: string[],
 *  skipped: string[],
 *  viruses: string[],
 *  total: number
 * }>}
 */
async function scanWindowsDefender(file) {
  await downloadFiles(file);

  const files = readdirSync("./infected");

  /**
   * @type {{
   *  isInfected: boolean,
   *  goodFiles: string[],
   *  badFiles: string[],
   *  skipped: string[],
   *  viruses: string[],
   *  total: number
   * }}
   */
  const response = {
    isInfected: false,
    goodFiles: [],
    badFiles: [],
    skipped: [],
    viruses: [],
    total: files.length,
  };

  for (const index in files) {
    const file = files[index];

    const out = await scanWindows(resolve(__dirname, "infected", file));

    const output = out.out;

    if (output.includes("was skipped")) {
      response.skipped.push(file);
    } else if (output.includes("found no threats")) {
      response.goodFiles.push(file);
    } else {
      response.isInfected = true;
      response.badFiles.push(file);
      response.viruses.push(`${file}\n${output}`);
    }
  }

  return response;
}
