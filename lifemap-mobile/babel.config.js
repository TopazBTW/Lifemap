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
    overrides: [
      {
        // The device runs an Expo Go whose Hermes cannot parse #private class
        // members, and @tanstack/query-core's "modern" build ships them
        // untranspiled ("Runtime not ready: SyntaxError: private properties
        // not supported" on boot). Transpile them away — but ONLY here.
        //
        // Scope matters: applying these plugins globally re-processes code
        // babel-preset-expo already handled and breaks it both ways — spec
        // mode throws "property is not configurable" in RN's VirtualizedList,
        // loose mode throws "Cannot assign to read-only property 'NONE'" in
        // the Event polyfill. Keep until the device situation changes.
        test: /node_modules[\\/]@tanstack[\\/]/,
        plugins: [
          ['@babel/plugin-transform-class-properties', { loose: true }],
          ['@babel/plugin-transform-private-methods', { loose: true }],
          ['@babel/plugin-transform-private-property-in-object', { loose: true }],
        ],
      },
    ],
  };
};
