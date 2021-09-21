import '../assets/css/article.css';

import { apiPage } from '../scripts/_axios.js';
import { createApp } from 'vue';
import './_common.js';
import { params } from '../scripts/_factory.js';
import ToolsPage from '../_components/ToolsPage.vue';
import ArticlePage from '../_components/ArticlePage.vue';

// 取得選單頁內容
apiPage({
  RouteName: params('page')
}).then(res => {
  const { status, data } = res;

  if (status === 200) {
    console.log(data);

    createApp(ToolsPage).provide('data', data).mount('#tools');
    createApp(ArticlePage).provide('data', data).mount('#article');
  }
});
