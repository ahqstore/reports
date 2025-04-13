// @ts-check

/**
 *
 * @param {string} method
 * @param {string} url
 * @param {Object | null} body
 * @param {string} reason
 * @returns {Promise<any>}
 */
module.exports = async (method, url, body, reason = "") => {
  const urlParsed = (() => {
    if (url.startsWith("http")) {
      return url;
    } else {
      return `https://discord.com/api/v10${url}`;
    }
  })();

  return await fetch(urlParsed, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bot ${process.env.BOT_TOKEN}`,
      "X-Audit-Log-Reason": reason,
    },
  })
    .then((d) => d.text())
    .then((d) => {
      try {
        return JSON.parse(d);
      } catch (_e) {
        return d;
      }
    });
};
