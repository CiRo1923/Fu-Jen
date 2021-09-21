const index = require('./htmlPage/index.js');
const nav = require('./htmlPage/nav.js');
const listCompusFocus = require('./htmlPage/list-campus-focus.js');
const listLatestNews = require('./htmlPage/list-latest-news.js');
const listHonorRoll = require('./htmlPage/list-honor-roll.js');
const listAudioVisual = require('./htmlPage/list-audio-visual.js');
const articleCompusFocus = require('./htmlPage/article-campus-focus.js');
const articleLatestNews = require('./htmlPage/article-latest-news.js');
const articleHonorRoll = require('./htmlPage/article-honor-roll.js');
const articleAudioVisual = require('./htmlPage/article-audio-visual.js');
const page = require('./htmlPage/page.js');

module.exports = {
  ieVersion: 0, // 10 或 0
  tailwindcss: true,
  desktopMinWidth: 1920,
  contentWidth: 960,
  mobileMaxWidth: 740,
  basicMobileWidth: 375,
  copyStatic: true,
  docker: false,
  https: false,
  rootDirectory: '/',
  component: '_components/',
  container: '_container/',
  js: 'scripts/',
  css: 'assets/css/',
  imgs: 'assets/img/',
  svg: '_svg/',
  fonts: null,
  proxy: {
    '/**': {
      target: 'http://api.ideakeys.com',
      changeOrigin: true
    }
  },
  plugins: () => {
    const def = [];
    let publish = def.concat(
      index.HtmlWebpackPlugin,
      nav.HtmlWebpackPlugin,
      listCompusFocus.HtmlWebpackPlugin,
      listLatestNews.HtmlWebpackPlugin,
      listHonorRoll.HtmlWebpackPlugin,
      listAudioVisual.HtmlWebpackPlugin,
      articleCompusFocus.HtmlWebpackPlugin,
      articleLatestNews.HtmlWebpackPlugin,
      articleHonorRoll.HtmlWebpackPlugin,
      articleAudioVisual.HtmlWebpackPlugin,
      page.HtmlWebpackPlugin
    );

    // if (process.env.NODE_ENV === 'production') {
    //   publish = def.concat(
    //     index.HtmlWebpackPlugin,
    //     nav.HtmlWebpackPlugin,
    //     listCompusFocus.HtmlWebpackPlugin,
    //     listLatestNews.HtmlWebpackPlugin,
    //     listHonorRoll.HtmlWebpackPlugin,
    //     listAudioVisual.HtmlWebpackPlugin,
    //     articleCompusFocus.HtmlWebpackPlugin,
    //     articleLatestNews.HtmlWebpackPlugin,
    //     articleHonorRoll.HtmlWebpackPlugin,
    //     articleAudioVisual.HtmlWebpackPlugin,
    //     page.HtmlWebpackPlugin
    //   );
    // }

    return publish;
  }
};
