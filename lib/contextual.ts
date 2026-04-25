import { getSiteUrl, siteConfig } from "@/site.config";

export const DOCS_ORIGIN = getSiteUrl();
export const MCP_SERVER_URL = new URL(siteConfig.mcp.route, `${DOCS_ORIGIN}/`)
  .toString()
  .replace(/\/+$/, "");
export const MCP_SERVER_NAME = siteConfig.mcp.name;
export const MCP_INSTALL_COMMAND = `npx add-mcp ${MCP_SERVER_URL} --name "${MCP_SERVER_NAME}"`;
