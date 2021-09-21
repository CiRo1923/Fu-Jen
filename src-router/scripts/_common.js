import 'regenerator-runtime/runtime';
import { createApp } from 'vue';
import Header from '../_components/VUE/Header.vue';
import Footer from '../_components/VUE/Footer.vue';
// import Nav from '../_components/VUE/Nav.vue';
// import router from '../router';

createApp(Header).mount('#header');
createApp(Footer).mount('#footer');
// createApp(Nav).mount('#nav');
