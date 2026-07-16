// NativeWind 4 setup. Note: babel-preset-expo already injects
// react-native-reanimated/plugin — adding it here (or the worklets plugin)
// causes "Duplicate plugin/preset detected". Do not add it.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
