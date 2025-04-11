const { Client, ActivityType } = require("discord.js");

module.exports = (intents = []) => {
  return new Client({
    intents,
    presence: {
      status: "idle",
      activities: [
        {
          name: "app reports",
          type: ActivityType.Watching,
        },
      ],
    },
  });
};
