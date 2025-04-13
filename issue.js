// @ts-check
const NodeClam = require("clamscan");
const { mkdirSync, writeFileSync } = require("fs");

(async () => {
  // Do Stuff
  await stuff();
})();

/**
 * @type {any}
 */
const event = require("./event.json");
const downloadFiles = require("./src/downloadFiles");
const checkAppId = require("./src/checkAppId");

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

  writeFileSync(
    "./oldscan.json",
    JSON.stringify({
      clamav: {
        badFiles,
        goodFiles,
        isInfected,
        viruses,
      },
      number: resp.data.id,
    })
  );

  // @formatter:off
  // prettier-ignore
  const stats = `# ClamAV
| Statistics     |                                                               |
| -------------- | ------------------------------------------------------------- |
| Total Files    | ${badFiles.length + goodFiles.length}                         |
| Total Infected | **${badFiles.length}**/${badFiles.length + goodFiles.length}  |
| Viruses        | **${viruses.join(", ")}**                                     |
| Infected       | **${isInfected ? "⚠️ Yes" : "✅ No"}**                        |

_Waiting for Windows Defender Scan Results_`;

  await github.rest.issues.updateComment({
    comment_id: resp.data.id,
    owner,
    repo,
    body: stats,
  });
}
