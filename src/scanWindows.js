const { spawn } = require("node:child_process");

/**
 *
 * @param {string} file
 * @returns {Promise<{ out: string, code: number }>} code
 */
module.exports = (file) => {
  const proc = spawn(`C:\\Program Files\\Windows Defender\\MpCmdRun.exe`, [
    "-Scan",
    "-ScanType",
    "3",
    "-File",
    file,
  ]);

  let output = "";

  proc.stdout.on("data", (resp) => {
    output += resp.toString();
  });

  return new Promise((res) => {
    proc.on("close", (code) => {
      res({ code, out: output });
    });
  });
};
