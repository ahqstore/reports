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
