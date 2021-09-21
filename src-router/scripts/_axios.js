import axios from 'axios';

const apiRequest = axios.create({
  baseURL: '/'
});

export const apiMenu = data => apiRequest.get('web/menus', { params: data });
