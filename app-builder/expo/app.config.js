// WHERE THE WEB VERSION IS SERVED (Phase B). The builder's phones load an app's
// web version from `/app-preview/<slug>/<token>/`, so every file it asks for must
// carry that prefix; Expo puts it there from `experiments.baseUrl`. Empty for
// anything else (the real phone build has no address).
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...(config.experiments || {}), baseUrl: process.env.EXPO_BASE_URL || "" },
});
