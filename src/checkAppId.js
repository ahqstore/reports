// @ts-check

const getApp = require("./getApp");
const getSha = require("./getSha");

const owner = "ahqstore";
const repo = "reports";

/**
 *
 * @param {import("@octokit/rest").Octokit} github
 * @param {string} appId
 * @param {number} number
 * @returns {Promise<{ data: import("ahqstore-types").AHQStoreApplication, urls: { url: string, file: string }[] } | false>}
 */
module.exports = async (github, appId, number) => {
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
