import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";
import { initStore } from "./store";

createApp(App).mount("#app");

void initStore();
