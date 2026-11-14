export { createTiptapDevtoolsHooks } from "./hooks";
export type { TiptapDevtoolsHookContext, TiptapDevtoolsHooks } from "./hooks";
export {
  attachTiptapDevtools,
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
  suspendTiptapDevtools,
  resumeTiptapDevtools,
} from "./lifecycle";
export type {
  TiptapDevtoolsEditor,
  TiptapDevtoolsOptions,
  TiptapDispatchTransactionProps,
} from "./lifecycle";
