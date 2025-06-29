/* global describe:false */
import { chai } from '@environment-safe/chai';
import { it } from '@open-automaton/moka';
import {
    McpServer, 
    ResourceTemplate,
    StdioServerTransport
} from '../src/index.mjs';
const should = chai.should();

describe('module', ()=>{
    describe('performs a simple test suite', ()=>{
        it('loads', async ()=>{
            should.exist(McpServer);
            should.exist(ResourceTemplate);
            should.exist(StdioServerTransport);
        });
    });
});

