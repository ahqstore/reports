// @ts-check
const axios = require("axios");

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

const owner = "ahqstore";
const repo = "reports";

async function stuff() {
  const av = await new NodeClam().init({
    debugMode: true,
    scanRecursively: true,
  });

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
   * @type {number}
   */
  const number = event.issue.number;

  const pr = event.issue.pull_request;

  if (pr) {
    return;
  }

  const bodyRegex = /---ISSUE---\n([\s\S]*?)\n---END---/;

  /**
   * @type {{ appId: string } | "<impossible>"}
   */
  const bodyParsed = (() => {
    try {
      return JSON.parse(bodyRegex.exec(body)?.at(1) || "<impossible>");
    } catch (_) {
      return "<impossible>";
    }
  })();

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
  const stats = `| Statistics     |                                                           |
| -------------- | ------------------------------------------------------------- |
| Total Files    | ${badFiles.length + goodFiles.length}                         |
| Total Infected | **${badFiles.length}**/${badFiles.length + goodFiles.length}  |
| Viruses        | **${viruses.join(", ")}**                                     |
| Infected       | **${isInfected ? "⚠️ Yes" : "✅ No"}**                        |

*This issue is now being transferred to our **Moderation Team***`;

  await github.rest.issues.updateComment({
    comment_id: resp.data.id,
    owner,
    repo,
    body: stats,
  });

  // prettier-ignore
  const embed = new EmbedBuilder()
    .setTitle(`Severity: ${isInfected ? "⚒️ Low" : "⚠️ Severe"}`)
    .setURL(url)
    .setFooter({
      text: "Report by AHQ Store Issues Bot",
      iconURL: "https://github.com/ahqstore.png",
    })
    .setColor(isInfected ? "Red" : "Yellow")
    .setDescription(
      `
      Report for ${app.data.appDisplayName} (${app.data.appId})

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
  });
}

/**
 *
 * @param {{ url: string, file: string }[]} files
 */
const downloadFiles = async (files) => {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    await download(file);
  }
};

/**
 *
 * @param {{ url: string, file: string }} file
 * @returns
 */
async function download(file) {
  return new Promise((res) => {
    const f = createWriteStream(`./infected/${file.file}`);

    axios({
      method: "GET",
      url: file.url,
      responseType: "stream",
    }).then((s) => s.data.pipe(f));

    f.on("finish", () => {
      res(undefined);
    });
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
    const app = await getApp(sha, appId);

    return app;
  } catch (e) {
    await err("Unknown Error.... ${e}");
    return false;
  }
};
