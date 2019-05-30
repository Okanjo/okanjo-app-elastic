module.exports = {

    elasticsearch: {

        client: {
            // see: https://github.com/elastic/elasticsearch-js#client-options
            name: 'Unit Test Connection', // name to identify the client instance in the events
            node: [process.env.ES_HOST || 'http://127.0.0.1:9041'], // the Elasticsearch endpoint to use
            requestTimeout: 5000, // max request timeout for each request, usesomething like 30k or 120k
            sniffOnStart: false,
            sniffInterval: 60000
        },

        unit_test_index: {
            template_name: 'unit_test_template',
            index_patterns: ["unit_test_things*"],
            template: require('./test_schema_template'),
            index: {
                name: 'unit_test',
                schema: require('./test_schema'),
                types: {
                    my_thing: 'my_thing'
                }
            }
        }
    },
};