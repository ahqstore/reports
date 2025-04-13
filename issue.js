// @ts-check
const NodeClam = require("clamscan");
const { mkdirSync, createWriteStream } = require("fs");

(async () => {
  // Do Stuff
  await stuff();
})();

/**
 * @type {any}
 */
const event = require("./event.json");
const getSha = require("./src/getSha");
const getApp = require("./src/getApp");
const { EmbedBuilder } = require("discord.js");
const downloadFiles = require("./src/downloadFiles");

const owner = "ahqstore";
const repo = "reports";

async function stuff() {
  const av = await new NodeClam().init({
    removeInfected: false, // If true, removes infected files
    quarantineInfected: false, // False: Don't quarantine, Path: Moves files to this place.
    scanLog: undefined, // Path to a writeable log file to write scan results into
    debugMode: true, // Whether or not to log info/debug/error msgs to the console
    fileList: undefined, // path to file containing list of files to scan (for scanFiles method)
    scanRecursively: true, // If true, deep scan folders recursively
    clamscan: {
      path: "/usr/bin/clamscan", // Path to clamscan binary on your server
      db: undefined, // Path to a custom virus definition database
      scanArchives: true, // If true, scan archives (ex. zip, rar, tar, dmg, iso, etc...)
      active: true, // If true, this module will consider using the clamscan binary
    },
    clamdscan: {
      socket: false, // Socket file for connecting via TCP
      host: "localhost", // IP of host to connect to TCP interface
      port: 3310, // Port of host to use when connecting via TCP interface
      timeout: 60000, // Timeout for scanning files
      localFallback: true, // Use local preferred binary to scan if socket/tcp fails
      path: "/usr/bin/clamdscan", // Path to the clamdscan binary on your server
      configFile: undefined, // Specify config file if it's in an unusual place
      multiscan: true, // Scan using all available cores! Yay!
      reloadDb: true, // If true, will re-load the DB on every call (slow)
      active: true, // If true, this module will consider using the clamdscan binary
      bypassTest: false, // Check to see if socket is available when applicable
      tls: false, // Use plaintext TCP to connect to clamd
    },
    preference: "clamscan", // If clamdscan is found and active, it will be used by default
  });

  const ping = () => av.ping();
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  // Keep trying 10times
  for (let i = 0; i < 10; i++) {
    try {
      await ping();
    } catch (e) {
      await delay(10_000);
      console.log(e);
    }
  }

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

  const pr = event.issue.pull_request;

  if (pr) {
    return;
  }

  const bodyRegex = /---ISSUE---\n([\s\S]*?)\n---END---/;

  const prsed = bodyRegex.exec(body)?.at(1) || "<impossible>";
  /**
   * @type {{ appId: string, os?: string } | "<impossible>"}
   */
  const bodyParsed = (() => {
    try {
      return JSON.parse(prsed);
    } catch (_) {
      return "<impossible>";
    }
  })();

  const otherBody = body.replace(prsed, "");

  if (!bodyRegex.test(body) || bodyParsed == "<impossible>") {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body: "The issue has no content / the content is malformed. Please create a new issue using the correct content schema...",
    });
    await github.rest.issues.update({
      owner,
      repo,
      issue_number: number,
      state: "closed",
      state_reason: "not_planned",
    });

    return;
  }

  mkdirSync("./infected");

  const app = await checkAppId(github, bodyParsed.appId, number);
  if (typeof app == "boolean" && app == false) return;

  const resp = await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: number,
    body: "Downloading files... Please Wait",
  });

  await downloadFiles(app.urls);

  await github.rest.issues.updateComment({
    comment_id: resp.data.id,
    owner,
    repo,
    body: "Scanning for Malware using ClamAV...",
  });

  const { badFiles, goodFiles, isInfected, viruses } = await av.scanDir(
    "./infected"
  );

  // @formatter:off
  // prettier-ignore
  const stats = `| Statistics     |                                                               |
| -------------- | ------------------------------------------------------------- |
| Total Files    | ${badFiles.length + goodFiles.length}                         |
| Total Infected | **${badFiles.length}**/${badFiles.length + goodFiles.length}  |
| Viruses        | **${viruses.join(", ")}**                                     |
| Infected       | **${isInfected ? "⚠️ Yes" : "✅ No"}**                        |

_Waiting for Windows Defender Outputs_
*This issue is now being transferred to our **Moderation Team***`;

  await github.rest.issues.updateComment({
    comment_id: resp.data.id,
    owner,
    repo,
    body: stats,
  });

  // prettier-ignore
  const embed = new EmbedBuilder()
    .setTitle(`Severity: ${!isInfected ? "⚒️ Low" : "⚠️ Severe"}`)
    .setURL(url)
    .setFooter({
      text: "Report by AHQ Store Issues Bot",
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
      
      ## Malware Report
      > **Total Files**:    ${badFiles.length + goodFiles.length}                         
      > **Total Infected**: **${badFiles.length}**/${badFiles.length + goodFiles.length}  
      > **Viruses**:        **${viruses.join(", ")}**                                     
      > **Infected**:       **${isInfected ? "⚠️ Yes" : "✅ No"}**  
      
      **Linked GitHub Issue:** ${url}
      
      > **Reference Issue Number:** ${number}

      ${otherBody.substring(0, 1000)}${otherBody.length > 1000 ? "..." : ""}
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
      content: isInfected ? `<@&1245401644733169724>` : `New Report`,
      embeds: [embed],
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 *
 * @param {import("@octokit/rest").Octokit} github
 * @param {string} appId
 * @param {number} number
 * @returns {Promise<{ data: import("ahqstore-types").AHQStoreApplication, urls: { url: string, file: string }[] } | false>}
 */
const checkAppId = async (github, appId, number) => {
  /**
   *
   * @param {string} msg
   */
  const err = async (msg) => {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body: msg,
    });
    await github.rest.issues.update({
      owner,
      repo,
      issue_number: number,
      state: "closed",
      state_reason: "not_planned",
    });
  };

  try {
    if (appId.length <= 1 || appId.includes(":")) {
      await err(
        "The App ID is not valid or does not point to the **community** repository."
      );
      return false;
    }

    const sha = await getSha();

    console.log(`Got SHA: ${sha}, AppID: ${appId}`);

    const app = await getApp(sha, appId);

    console.log(`Got Application: ${app}`);

    return app;
  } catch (e) {
    await err(`Application Not Found!\n\n# Trace\n${e}`);
    return false;
  }
};
