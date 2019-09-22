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
    path: path.join(__dirname, 'dist'),
    filename: 'bootstrap.js'
  },
  plugins: [
    new CopyWebpackPlugin(['index.html'])
  ],
};
