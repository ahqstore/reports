const { InstallerFormat } = require("ahqstore-types");
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
      case InstallerFormat.AndroidApkZip:
        file = `${i}.apk`;
        break;
      case InstallerFormat.LinuxAppImage:
        file = `${i}.AppImage`;
        break;
      case InstallerFormat.WindowsInstallerExe:
        file = `${i}.exe`;
        break;
      case InstallerFormat.WindowsInstallerMsi:
        file = `${i}.msi`;
        break;
      case InstallerFormat.WindowsUWPMsix:
        file = `${i}.msix`;
        break;
      case InstallerFormat.WindowsZip:
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
