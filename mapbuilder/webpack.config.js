const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js', '.wasm' ]
  },
  output: {
    filename: 'index.js'
  },
  plugins: [
    new CopyWebpackPlugin(['index.html'])
  ],
};
