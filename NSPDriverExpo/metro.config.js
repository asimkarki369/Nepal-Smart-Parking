const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// On web, swap native-only modules for lightweight stubs
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    const stubs = {
      'react-native-maps': path.resolve(__dirname, 'src/mocks/react-native-maps.tsx'),
    };
    if (stubs[moduleName]) {
      return { filePath: stubs[moduleName], type: 'sourceFile' };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
