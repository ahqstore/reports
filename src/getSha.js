const owner = "ahqstore";
const repo = "repo_community";

module.exports = async () => {
  const commit = (
    await fetch(`https://api.github.com/repos/${owner}/${repos}/commits`).then(
      (s) => s.json()
    )
  )[0];

  return commit.sha;
};

module.exports.owner = owner;
module.exports.repo = repo;
