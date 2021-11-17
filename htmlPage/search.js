module.exports = {
  HtmlWebpackPlugin: [{
    filename: 'University/Web/zhTW/Search/index.html',
    template: '_shared/layout.ejs',
    includeName: 'Search/index.ejs',
    description: '',
    chunks: ['search']
  }, {
    filename: 'University/Web/enUS/Search/index.html',
    template: '_shared/layout.ejs',
    includeName: 'Search/index.ejs',
    description: '',
    chunks: ['search']
  }]
};
