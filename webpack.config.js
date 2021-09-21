let IP = null;
const CONFIG = require('./config.js');
const PATH = require('path');
const WEBPACKP = require('webpack');
const MINiCSSEXTRACTPLUGIN = require('mini-css-extract-plugin');
const HTMLWEBPACKPLUGIN = require('html-webpack-plugin');
const BEAUTIFYHTMLWEBPACKPLUGIN = require('beautify-html-webpack-plugin');
const TERSERPLUGIN = require('terser-webpack-plugin');
const { HtmlWebpackSkipAssetsPlugin } = require('html-webpack-skip-assets-plugin');
const IMAGEMINIMIZERPLUGIN = require('image-minimizer-webpack-plugin');
const COPYPLUGIN = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const { extendDefaultPlugins } = require('svgo');

require('dotenv').config({ path: PATH.join(__dirname, '.env') });

Object.keys(require('os').networkInterfaces()).forEach(devName => {
  const iface = require('os').networkInterfaces()[devName];

  for (let i = 0; i < iface.length; i += 1) {
    const alias = iface[i];
    if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal && !new RegExp('^172').test(alias.address)) {
      IP = alias.address;
    }
  }
});

const extendPlugins = () => {
  const miniCssExtractCSS = new MINiCSSEXTRACTPLUGIN({
    filename: (CONFIG.css + (CONFIG.commonCss ? `${CONFIG.commonCss}.css?[hash:8]` : '[name].css?[hash:8]'))
  });
  let copyWebpackPlugin = [];
  const htmlWebpackPlugin = [];
  const beautifyHtmlWebpackPlugin = new BEAUTIFYHTMLWEBPACKPLUGIN();
  const webpackDefinePlugin = new WEBPACKP.DefinePlugin({
    'process.env': {
      APP_ENV: JSON.stringify((process.env.APP_ENV
        ? process.env.APP_ENV
        : process.env.NODE_ENV)),
      IE_VERSION: JSON.stringify((CONFIG.ieVersion !== 0 ? `IE ${CONFIG.ieVersion}` : 'Microsoft Edge'))
    }
  });
  const cleanWebpackPlugin = process.env.NODE_ENV !== 'development'
    ? new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*']
    }) : () => {};

  for (let i = 0; i < CONFIG.plugins().length; i += 1) {
    let obj = CONFIG.plugins()[i];

    obj.inject = 'body';
    obj.cache = true;

    htmlWebpackPlugin.push(
      new HTMLWEBPACKPLUGIN(obj)
    );
  }

  if (CONFIG.copyStatic) {
    const copy = [];
    copy.push({
      from: 'static',
      to: 'static'
    });

    if (CONFIG.docker) {
      copy.push({
        from: 'docker',
        to: ''
      });
    }

    if (CONFIG.copyData) {
      for (let i = 0; i < CONFIG.copyData.length; i += 1) {
        let copyItem = CONFIG.copyData[i];

        if (typeof copyItem === 'string') {
          copy.push({
            from: copyItem,
            to: copyItem
          });
        } else if (typeof copyItem === 'object') {
          copy.push({
            from: copyItem.from,
            to: copyItem.to
          });
        }
      }
    }

    copyWebpackPlugin = [new COPYPLUGIN({
      patterns: copy
    })];
  }

  return [miniCssExtractCSS].concat(
    [cleanWebpackPlugin],
    [webpackDefinePlugin],
    copyWebpackPlugin,
    htmlWebpackPlugin,
    [beautifyHtmlWebpackPlugin],
    [new HtmlWebpackSkipAssetsPlugin()],
    [new VueLoaderPlugin()]
  );
};

const resolveModules = () => {
  const pathReturn = [PATH.resolve('src/')];

  Object.keys(CONFIG).forEach((value) => {
    if (typeof (CONFIG[value]) === 'string') {
      pathReturn.push('' + PATH.resolve('src/' + CONFIG[value] + '') + '');
    }
  });

  pathReturn.push(PATH.resolve('node_modules'));

  return pathReturn;
};

const resolveAlias = () => {
  const pathReturn = {
    vue: '@vue/runtime-dom',
    vuex: 'vuex/dist/vuex.esm-bundler'
  };

  Object.keys(CONFIG).forEach((value) => {
    if (typeof (CONFIG[value]) === 'string') {
      pathReturn[`${value}`] = PATH.join(__dirname, `src/${CONFIG[value]}`);
    }
  });

  return pathReturn;
};

module.exports = {
  context: PATH.resolve(__dirname, 'src'),
  cache: {
    type: 'memory'
  },
  entry() {
    const pathReturn = {};

    for (let i = 0; i < CONFIG.plugins().length; i += 1) {
      const entry = CONFIG.plugins()[i];

      if (entry.chunks) {
        for (let j = 0; j < entry.chunks.length; j += 1) {
          const chunks = entry.chunks[j];

          pathReturn[chunks] = `./${CONFIG.js + chunks}.js`;
        }
      }
    }

    return pathReturn;
  },
  output: {
    path: PATH.resolve(__dirname, 'dist'),
    filename: `${CONFIG.js}[name].js?[hash:8]`,
    publicPath: CONFIG.rootDirectory ? CONFIG.rootDirectory : 'auto',
    pathinfo: false
  },
  module: {
    rules: [{
      test: /\.ejs$/i,
      use: [{
        loader: 'ejs-easy-loader'
      }]
    }, {
      test: /\.vue$/,
      use: [{
        loader: 'vue-loader'
      }]
    }, {
      test: /\.(tsx?|jsx?)$/,
      use: [{
        loader: 'babel-loader',
        options: {
          cacheDirectory: true,
          include: PATH.resolve(__dirname, '../src'),
          configFile: `${__dirname}/.babelrc`,
          presets: [
            ['@babel/preset-env', {
              targets: {
                edge: '17',
                firefox: '60',
                chrome: '67',
                safari: '11.1',
                ie: '10'
              }
            }]
          ]
        }
      }],
      include: PATH.resolve('src')
    }, {
      test: /\.s?css$/i,
      use: [
        {
          loader: MINiCSSEXTRACTPLUGIN.loader,
          options: {
            publicPath: (resourcePath, context) => {
              return (PATH.relative(PATH.dirname(resourcePath), context).replace(/\\/g, '/')) + '/';
            }
          }
        },
        'css-loader',
        'postcss-loader'
      ]
    }, {
      test: /\.postcss$/,
      use: [
        'vue-style-loader',
        'css-loader',
        'postcss-loader'
      ]
    }, {
      test: /\.(jpe?g|png|gif|svg)$/i,
      type: 'asset/resource',
      include: PATH.resolve(__dirname, `src/${CONFIG.imgs}`),
      generator: {
        filename: '[path][name][ext]?[hash:8]'
      },
      use: [
        {
          loader: IMAGEMINIMIZERPLUGIN.loader,
          options: {
            minimizerOptions: {
              plugins: [
                ['gifsicle', {
                  interlaced: true,
                  optimizationLevel: 3
                }],
                ['jpegtran', {
                  progressive: true,
                  quality: 75
                }],
                ['pngquant', {
                  quality: [0.60, 0.75],
                  speed: 4
                }],
                ['svgo', {
                  plugins: extendDefaultPlugins([{
                    name: 'removeViewBox',
                    active: false
                  }])
                }]
              ]
            }
          }
        }
      ]
    }, {
      test: /\.(jpe?g|png)$/i,
      use: [
        {
          loader: IMAGEMINIMIZERPLUGIN.loader,
          options: {
            deleteOriginalAssets: false,
            filename: '[path][name].webp?[hash:8]',
            minimizerOptions: {
              plugins: [
                ['webp', {
                  quality: 88
                }]
              ]
            }
          }
        }
      ]
    }, {
      test: /\.svg$/,
      include: PATH.resolve(__dirname, `src/${CONFIG.svg}`),
      use: [
        {
          loader: 'svg-sprite-loader'
        },
        'svgo-loader'
      ]
    }, {
      test: /\.(woff|woff2|ttf|eot|svg)$/,
      include: PATH.resolve(__dirname, `src/${CONFIG.fonts}`),
      type: 'asset/resource',
      generator: {
        filename: '[path][name][ext]?[hash:8]'
      }
      // use: 'file-loader?name=[path][name].[ext]?[hash]'
    }]
  },
  optimization: {
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false,
    minimizer: [
      // new OptimizeCSSAssetsPlugin({
      //   cssProcessor: cssnano,
      //   cssProcessorPluginOptions: {
      //     preset: ['default', {
      //       discardComments: {
      //         removeAll: true,
      //       },
      //     }],
      //   },
      //   canPrint: true,
      // }),
      new TERSERPLUGIN({
        extractComments: false,
        parallel: true,
        terserOptions: {
          output: {
            comments: false
          },
          compress: {
            warnings: false,
            drop_console: true,
            drop_debugger: true
          }
        }
      })
    ]
  },
  plugins: extendPlugins(),
  devServer: {
    // contentBase : PATH.join(__dirname, 'dist'),
    // index            : 'index.htm',
    host: IP,
    hot: true,
    watchContentBase: true,
    compress: true,
    port: process.env.PORT,
    https: CONFIG.https ? CONFIG.https : false,
    stats: {
      assets: true,
      cached: false,
      chunkModules: false,
      chunkOrigins: false,
      chunks: false,
      colors: true,
      hash: false,
      modules: false,
      reasons: false,
      source: false,
      version: false,
      warnings: false,
      children: true
    },
    before(app) {
      if (!CONFIG.proxy) {
        app.post('*', (req, res) => {
          res.redirect(req.originalUrl);
        });
      }
    },
    // proxy: {
    //     "/api": {
    //         target: 'https://192.168.1.155:'+CONFIG.port+'',
    //         bypass: function(req, res, proxyOptions) {
    //             if(req.method != 'POST') return false;
    //         }
    //     }
    // }
    historyApiFallback: true,
    proxy: CONFIG.proxy ? CONFIG.proxy : {}
  },
  resolve: {
    mainFields: ['main'],
    modules: resolveModules(),
    extensions: ['.js', '.vue'],
    alias: resolveAlias()
  }
};
