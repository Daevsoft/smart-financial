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
    // The dev server serves ./public automatically; a build has to copy it so
    // the manifest, service worker and icons land next to the bundle.
    new rspack.CopyRspackPlugin({
      patterns: [{ from: "public", noErrorOnMissing: true }],
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