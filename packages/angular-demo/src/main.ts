import "zone.js";
import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app.component";
import "@prosemirror-devtools/demo-kit/styles.css";

void bootstrapApplication(AppComponent).catch((error: unknown) => console.error(error));
