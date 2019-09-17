const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './bootstrap.js',
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
    filename: 'bootstrap.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new CopyWebpackPlugin(['index.html'])
  ],
};
