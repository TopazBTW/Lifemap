const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// firebase: the `firebase` wrapper's exports map has no "react-native"
// condition, and SDK 57's default condition list is empty — so Metro resolves
// firebase/auth to the *web* build and getReactNativePersistence is undefined
// at runtime. Restoring the condition list makes the inner @firebase/auth
// resolve to dist/rn/index.js. See .claude/skills/lifemap-stack.
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];

module.exports = withNativeWind(config, { input: './src/global.css' });
