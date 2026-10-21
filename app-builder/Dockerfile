# THE APP BUILDER (2026-10-20, owner: "yea separate container for the app").
#
# A customer's published website, made into an Android app with Capacitor. Its
# own image and its own container class (`AppBuildContainer`), so the website
# builder's image stays as it was: Java, the Android SDK and Gradle's
# libraries add about 2 GB (measured, docs/investigations/
# 2026-10-20-android-build-measurement.md), and only an app build pays for them.
#
# EVERYTHING A BUILD NEEDS IS IN THE IMAGE: the template project is built once
# here, so Gradle's libraries are in its cache and a customer's build runs
# offline (`--offline`), with nothing downloaded and no Maven rate limit to
# meet. Measured: a warm build is 25 s on 4 CPUs, 62 s on one.
#
# The context is this directory (wrangler.jsonc names `./app-builder/Dockerfile`).
FROM eclipse-temurin:21-jdk-jammy

# Node 22, for Capacitor's command line.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unzip \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# The Android SDK: the command-line tools, platform 36 and build-tools 36
# (Capacitor 8 compiles against 36).
ENV ANDROID_HOME=/opt/android-sdk
RUN mkdir -p $ANDROID_HOME/cmdline-tools \
  && curl -fsSL -o /tmp/clt.zip https://dl.google.com/android/repository/commandlinetools-linux-9862592_latest.zip \
  && unzip -q /tmp/clt.zip -d /tmp/clt && mv /tmp/clt/cmdline-tools $ANDROID_HOME/cmdline-tools/latest && rm -rf /tmp/clt /tmp/clt.zip \
  && yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses > /dev/null \
  && $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" > /dev/null

ENV GRADLE_USER_HOME=/opt/gradle-home
WORKDIR /app
COPY package.json server.mjs app-config.mjs expo-preview.mjs ./
COPY template/ ./template/

# THE WARM-UP: the template made into an Android project and built once, so the
# Gradle distribution and every library are cached in the image.
RUN cd template && npm install --no-audit --no-fund --loglevel=error \
  && npx cap add android \
  && echo "sdk.dir=$ANDROID_HOME" > android/local.properties \
  && cd android && ./gradlew assembleDebug --no-daemon -q \
  && ./gradlew clean --no-daemon -q

# THE EXPO KIT (2026-10-21, phase B): the real-app template, its libraries
# installed from its lockfile, and one export run here so Metro's caches are
# warm and a customer's preview downloads nothing.
COPY expo/ ./expo/
RUN cd expo && npm ci --no-audit --no-fund --loglevel=error \
  && CI=1 npx expo export -p web > /dev/null && rm -rf dist

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.mjs"]
