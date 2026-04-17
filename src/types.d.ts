declare module '@brave/brave-search-mcp-server/dist/config.js' {
  export function getOptions(): any;
}

declare module '@brave/brave-search-mcp-server/dist/protocols/http.js' {
  const httpServer: {
    createApp: () => any;
    start: () => void;
  };
  export default httpServer;
}
