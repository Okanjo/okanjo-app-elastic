"use strict";

module.exports = {
    elasticsearch: {

        // client connection config
        client: {
            // see: https://github.com/elastic/elasticsearch-js#client-options
            name: 'Example Connection', // name to identify the client instance in the events
            node: [process.env.ES_HOST || 'http://127.0.0.1:9041'], // the Elasticsearch endpoint to use
            requestTimeout: 5000, // max request timeout for each request, usesomething like 30k or 120k
            sniffOnStart: false,
            sniffInterval: 60000
        },

        // a typical index config
        example: {
            // template_name: 'example_template',
            // index_patterns: ["example_things*"],
            index: {
                name: 'example-foods',
                schema: require('./indicies/foods'),
                types: { // enumeration for the types you defined in the schema, to make it easy for query purposes later
                    _doc: '_doc'
                }
            },
        }
    }
};