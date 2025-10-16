"use strict";

const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')
const SitemapPlugin = require('sitemap-webpack-plugin').default;

const cesiumSource = "node_modules/cesium/Build/Cesium";
// this is the base url for static files that CesiumJS needs to load
// Not required but if it's set remember to update CESIUM_BASE_URL as shown below
const cesiumBaseUrl = "cesiumStatic";

const buildDate = new Date().toISOString();
const pageName = "Leylines - Bathymetry";
const pageDescription = "A visualisation of the current bathymetry";
const pageURL = "https://bathymetry.leylines.net/";

const paths = [
  {
    path: '/',
    lastmod: buildDate
  }
];

module.exports = {
  context: __dirname,
  entry: {
    app: "./src/index.js",
  },
  output: {
    filename: "app.js",
    path: path.resolve(__dirname, "docs"),
    sourcePrefix: "",
  },
  resolve: {
    mainFiles: ["index", "Cesium"],
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|gif|jpg|jpeg|svg|xml|json)$/,
        type: "asset/inline",
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      buildDate: buildDate,
      pageURL: pageURL,
      pageName: pageName,
      pageDescription: pageDescription,
      template: "src/index.html",
    }),
    new FaviconsWebpackPlugin({
      logo: 'src/leylines-sign.png',
      prefix: 'favicons/',
    }),
    new SitemapPlugin({
      base: pageURL,
      paths,
      options: {
        filename: 'sitemap.xml',
        lastmod: true,
        changefreq: 'weekly',
        priority: 1.0
      }
    }),
    // Copy Cesium Assets, Widgets, and Workers to a static directory
    new CopyWebpackPlugin({
      patterns: [
        { from: "src/robots.txt" },
        { from: "src/CNAME" },
        {
          from: path.join(cesiumSource, "Workers"),
          to: `${cesiumBaseUrl}/Workers`,
        },
        {
          from: path.join(cesiumSource, "ThirdParty"),
          to: `${cesiumBaseUrl}/ThirdParty`,
        },
        {
          from: path.join(cesiumSource, "Assets"),
          to: `${cesiumBaseUrl}/Assets`,
        },
        {
          from: path.join(cesiumSource, "Widgets"),
          to: `${cesiumBaseUrl}/Widgets`,
        },
      ],
    }),
    new webpack.DefinePlugin({
      // Define relative base path in cesium for loading assets
      CESIUM_BASE_URL: JSON.stringify(cesiumBaseUrl),
    }),
  ],
  mode: "development",
  devtool: "eval",
};
