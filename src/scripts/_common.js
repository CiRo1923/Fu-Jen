import 'regenerator-runtime/runtime';
import { apiInfo } from './_axios.js';
import { createApp } from 'vue';
import Header from '../_components/Header.vue';
import Footer from '../_components/Footer.vue';

const svgRequire = requireContext => requireContext.keys().map(requireContext);
const req = require.context('../_svg/', true, /\.svg$/);
svgRequire(req);

export const saveScrollTo = (e) => {
  e.preventDefault();
  sessionStorage.setItem('scrollTo', 'true');

  window.location.href = e.currentTarget.href;
};

// 取得 Information api
apiInfo().then(res => {
  const { status, data } = res;
  console.log(res);

  if (status === 200) {
    createApp(Header).provide('set', data.data).mount('#header');
    createApp(Footer).provide('set', data.data).mount('#footer');
  }
});
