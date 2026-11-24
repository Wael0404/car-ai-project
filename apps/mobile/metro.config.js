const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// three.js' CommonJS entry (picked by @react-three/fiber's require("three"))
// calls process.emitWarning, which does not exist in React Native and crashes
// the app. Always resolve "three" to its ES module build instead.
const threeModule = path.join(__dirname, "node_modules/three/build/three.module.js");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    return { type: "sourceFile", filePath: threeModule };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
