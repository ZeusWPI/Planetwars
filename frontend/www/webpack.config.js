const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require('path');

module.exports = {
    mode: 'development',
    entry: './bootstrap.js',
    module: {
        rules: [{
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/
        }]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.wasm']
    },
    output: {
        publicPath: "/frontend/",
        path: path.join(__dirname, 'frontend'),
        filename: 'bootstrap.js',
        library: 'visualizer'
    },
    plugins: [
        new CopyWebpackPlugin(['index.html'])
    ],
};