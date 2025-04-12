const { owner, repo } = require("./getSha");

module.exports = async (sha, app) => {
  /**
   * @type {import("ahqstore-types").AHQStoreApplication}
   */
  const data = await fetch(
    `https://rawcdn.githack.com/${owner}/${repo}/${sha}/db/apps/${app}.json`
  )
    .then((d) => {
      if (!d.ok) {
        throw new Error("Not OK");
      }

      return d;
    })
    .then((d) => d.json());

  /**
   * @type {{ url: string, file: string }[]}
   */
  const urls = [];

  Object.values(data.downloadUrls).forEach((data, i) => {
    const typ = data.installerType;

    let file = `${i}.bin`;

    switch (typ) {
      case 5:
        file = `${i}.apk`;
        break;
      case 4:
        file = `${i}.AppImage`;
        break;
      case 2:
        file = `${i}.exe`;
        break;
      case 1:
        file = `${i}.msi`;
        break;
      case 3:
        file = `${i}.msix`;
        break;
      case 0:
        file = `${i}.zip`;
        break;
    }

    urls.push({
      url: data.url,
      file,
    });
  });

  return {
    data,
    urls,
  };
};
