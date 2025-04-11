// @ts-check

const { Octokit } = require("@octokit/rest");

const getClient = require("./src/getClient");

const client = getClient();

client.login(process.env.BOT_TOKEN);

client.on("ready", async () => {
  // Do Stuff
  await stuff();

  client.destroy();
  process.exit(0);
});

/**
 * @type {any}
 */
const event = require("./event.json");

const github = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  userAgent: "AHQ Store Issues Bot",
});

const owner = "ahqstore";
const repo = "reports";

async function stuff() {
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

  const bodyParsed = bodyRegex.exec(body)?.at(1) || "<impossible>";

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
    });

    return;
  }
}
