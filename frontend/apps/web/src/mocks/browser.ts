import { handlers } from "@nextcrop/testing";
import { setupWorker } from "msw/browser";

export const worker = setupWorker(...handlers);
