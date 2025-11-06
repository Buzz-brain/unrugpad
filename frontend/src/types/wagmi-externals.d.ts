// Temporary ambient module declarations to satisfy TypeScript for deep imports
// These mirror the runtime packages installed as @wagmi/core and @wagmi/connectors

declare module '@wagmi/core/providers/jsonRpc' {
  import type { Provider } from 'viem';
  export function jsonRpcProvider(config: any): any;
}

declare module '@wagmi/connectors/injected' {
  export class InjectedConnector {
    constructor(config?: any);
  }
  export default InjectedConnector;
}

declare module '@wagmi/connectors/walletConnect' {
  export class WalletConnectConnector {
    constructor(config?: any);
  }
  export default WalletConnectConnector;
}
