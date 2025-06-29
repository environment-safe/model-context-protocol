// for symbolic deps we'll include them here, for static compilation
// this prevents the typescript tar trap so we can work source-first
// A cleaner implementation would mess up tree shaking, but this API is a mess

import { 
    McpServer, 
    ResourceTemplate
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
    StdioServerTransport 
} from "@modelcontextprotocol/sdk/server/stdio.js";

export {
    McpServer, 
    ResourceTemplate, 
    StdioServerTransport
}