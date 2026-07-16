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
    plugins: [
      // The user's device runs an Expo Go whose Hermes cannot parse #private
      // class members, and firebase v12 ships them untranspiled ("Runtime not
      // ready: SyntaxError: private properties not supported"). Transpile them
      // to WeakMap-based code. Keep until the device situation changes.
      '@babel/plugin-transform-class-properties',
      '@babel/plugin-transform-private-methods',
      '@babel/plugin-transform-private-property-in-object',
    ],
  };
};
