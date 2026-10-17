import { rspack } from "@rspack/core";
import MonacoWebpackPlugin from "monaco-editor-webpack-plugin";

export default {
  entry: "./index.js",
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: "./index.html",
    }),
    new MonacoWebpackPlugin({
      languages: ["javascript", "typescript", "html", "css"],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
      {
        test: /\.png$/i,
        type: "asset/resource",
      },
      {
        test: /\.ttf$/i,
        type: "asset/resource",
      },
      {
        test: /\.svg$/i,
        type: "asset/source",
      },
    ],
  },
  devServer: {
    hot: false,
    historyApiFallback: true,
  },
};