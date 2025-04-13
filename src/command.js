const { spawn } = require("node:child_process");

module.exports = async (file) => {
  spawn(
    `C:\\Program Files\\Windows Defender\\MpCmdRun.exe`,
    ["-Scan", "-ScanType", "3", "-File", "./src/*"],
    {}
  );
};
