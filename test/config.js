module.exports = {

    elasticsearch: {
        host: process.env.ES_HOST || '192.168.99.100:9200', //hostname:port of elastic instance(s)
        requestTimeout: 120000, // how long to wait until the response is assumed to be abandoned
        log: 'warning', // logging level, one of: error, warning, info, debug, trace

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