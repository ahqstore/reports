// @ts-check

const { resolve } = require("path");
const scanWindows = require("./src/scanWindows");
const { readdirSync, mkdirSync, readFileSync } = require("fs");

/**
 * @type {any}
 */
const event = require("./event.json");
const getSha = require("./src/getSha");
const getApp = require("./src/getApp");
const { EmbedBuilder } = require("discord.js");
const downloadFiles = require("./src/downloadFiles");
const checkAppId = require("./src/checkAppId");

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
  const url = event.issue.url || "";

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
  | Viruses        | **${win32.viruses.join(", ")}**                                                 |
  | Infected       | **${win32.isInfected ? "⚠️ Yes" : "✅ No"}**                                    |
 
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

  // prettier-ignore
  const embed = new EmbedBuilder()
    .setTitle(`Severity: ${!(isInfected || win32.isInfected) ? "⚒️ Low" : "⚠️ Severe"}`)
    .setURL(url)
    .setFooter({
      text: `Reference Issue Number: ${number}`,
      iconURL: "https://github.com/ahqstore.png",
    })
    .setColor(isInfected ? "Red" : "Yellow")
    .setDescription(
      `
      Report for ${app.data.appDisplayName} (${app.data.appId})

      **Reported by:** \`@${username}\`
      **OS:** ${bodyParsed.os || "Unknown"}

      ## Application Details
      **App Name:** ${app.data.appDisplayName}
      **App ID:** ${app.data.appId}
      **App Version:** ${app.data.verified}
      **Author:** ${app.data.authorId}
      **Repository:** https://github.com/${app.data.repo.author}/${app.data.repo.repo}
      
      ## ClamAV Report
      > **Total Files**:    ${badFiles.length + goodFiles.length}                         
      > **Total Infected**: **${badFiles.length}**/${badFiles.length + goodFiles.length}  
      > **Viruses**:        **${viruses.join(", ")}**                                     
      > **Infected**:       **${isInfected ? "⚠️ Yes" : "✅ No"}**  


      ## Windows Defender Report
      > **Total Files**:    ${win32.badFiles.length + win32.goodFiles.length}/${win32.total}                         
      > **Total Infected**: **${win32.badFiles.length}**/${win32.badFiles.length + win32.goodFiles.length}  
      > **Total Skipped**:  **${win32.skipped}**
      > **Viruses**:        **${win32.viruses.join(", ")}**                                     
      > **Infected**:       **${win32.isInfected ? "⚠️ Yes" : "✅ No"}**
      
      **Linked GitHub Issue:** ${url}

      ${otherBody.trim().substring(0, 1000)}${otherBody.length > 1000 ? "..." : ""}
    `
    )
    .toJSON();

  /**
   * @type {string}
   */
  const webhook = process.env.WEBHOOK || "";

  await fetch(webhook, {
    method: "POST",
    body: JSON.stringify({
      content:
        isInfected || win32.isInfected
          ? `<@&1245401644733169724> <@&1142141595555205190>`
          : `New Report`,
      embeds: [embed],
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
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
