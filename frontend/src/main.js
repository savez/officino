import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './stili/officina.scss'
import './bootstrap-js'
import 'bootstrap-icons/font/bootstrap-icons.css'

createApp(App).use(router).mount('#app')
