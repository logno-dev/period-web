import { mount, StartClient } from "@solidjs/start/client";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

mount(() => <StartClient />, document.getElementById("app")!);
