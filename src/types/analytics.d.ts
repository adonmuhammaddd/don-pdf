// Injected at runtime by the self-hosted analytics SDK (analytics.dondev.id/sdk.js).
interface Window {
  analytics?: {
    track: (name: string, props?: Record<string, unknown>) => void;
    pageview: () => void;
  };
}
