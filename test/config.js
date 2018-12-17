module.exports = {

    elasticsearch: {
        host: [process.env.ES_HOST || 'http://127.0.0.1:9200', 'http://127.0.0.1:9041'], //hostname:port of elastic instance(s), array of urls, etc
        requestTimeout: 120000, // how long to wait until the response is assumed to be abandoned
        log: 'warning', // logging level, one of: error, warning, info, debug, trace
        apiVersion: process.env.ES_VERSION,
        // sniffOnStart: true,

        // the index the service should manage
        index: {
            name: 'unit_test',
            schema: require('./test_schema'),
            types: {
                my_thing: 'my_thing'
            }
        }
    }
};