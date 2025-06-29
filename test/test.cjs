const should = require('chai').should();
const {
    McpServer, 
    ResourceTemplate,
    StdioServerTransport
} = require('../dist/index.cjs');

describe('module', ()=>{
    describe('performs a simple test suite', ()=>{
        it('loads', async ()=>{
            should.exist(McpServer);
            should.exist(ResourceTemplate);
            should.exist(StdioServerTransport);
        });
    });
});
