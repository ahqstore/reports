const owner = "ahqstore";
const repo = "repo_community";

module.exports = async () => {
  const commit = (
    await fetch(`https://api.github.com/repos/${owner}/${repo}/commits`, {
      headers: {
        "User-Agent": "AHQ Store Issues Bot",
        "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    }).then((s) => s.json())
  )[0];

  return commit.sha;
};

module.exports.owner = owner;
module.exports.repo = repo;
