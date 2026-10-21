// WHERE THE WEB VERSION IS SERVED (Phase B). The builder's phones load an app's
// web version from `/app-preview/<slug>/<token>/`, so every file it asks for must
// carry that prefix; Expo puts it there from `experiments.baseUrl`. Empty for
// anything else (the real phone build has no address).
//
// AN INSTALLABLE APP'S NAME AND ID come the same way (phase D): the app builder
// sets them per app, so every customer's app installs as itself.
module.exports = ({ config }) => ({
  ...config,
  name: process.env.EXPO_APP_NAME || config.name,
  slug: process.env.EXPO_APP_SLUG || config.slug,
  android: { ...(config.android || {}), package: process.env.EXPO_ANDROID_PACKAGE || "dev.gofarther.app" },
  ios: { ...(config.ios || {}), bundleIdentifier: process.env.EXPO_ANDROID_PACKAGE || "dev.gofarther.app" },
  experiments: { ...(config.experiments || {}), baseUrl: process.env.EXPO_BASE_URL || "" },
});
