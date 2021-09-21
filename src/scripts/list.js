import '../assets/css/list.css';

import { apiCategories } from '../scripts/_axios.js';
import { createApp } from 'vue';
import './_common.js';
import { getFunctionCadeData } from '../scripts/_factory.js';
import Tools from '../_components/Tools.vue';
import List from '../_components/List.vue';

apiCategories({
  FunctionCode: getFunctionCadeData().id
}).then(res => {
  const { status, data } = res;

  if (status === 200) {
    console.log(data);

    createApp(Tools).provide('data', data).mount('#tools');
    createApp(List).provide('data', data).mount('#list');
  }
});
