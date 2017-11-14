"use strict";

module.exports = {
    elasticsearch: {
        host: process.env.ES_HOST || '192.168.99.100:9200', // e.g. user:pass@hostname:port of elastic instance(s)
        requestTimeout: 120000, // how long to wait (in milliseconds) until a response is assumed to be abandoned (e.g. bulk loading)
        log: 'warning', // logging level, one of: error, warning, info, debug, trace

        // the index the service should manage
        index: {
            name: 'foods',
            schema: require('./indicies/foods'),
            types: { // enumeration for the types you defined in the schema, to make it easy for query purposes later
                fruit: 'fruit',
                veggie: 'veggie'
            }
        }
    }
};