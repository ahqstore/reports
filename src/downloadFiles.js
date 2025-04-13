//@s-check

const axios = require("axios");

/**
 *
 * @param {{ url: string, file: string }[]} files
 */
module.exports = async (files) => {
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
      headers: {
        "User-Agent": "AHQ Store Issues Bot",
        "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    }).then((s) => s.data.pipe(f));

    f.on("finish", () => {
      res(undefined);
    });
  });
}
