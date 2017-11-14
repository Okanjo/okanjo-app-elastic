"use strict";

const OkanjoApp = require('okanjo-app');
// const ElasticService = require('okanjo-app-elastic');
const ElasticService = require('../../ElasticService');

const config = require('./config');

const app = new OkanjoApp(config);
app.services = {
    elastic: new ElasticService(app, config.elasticsearch)
};

app.connectToServices(() => {
    // if we got here, elasticsearch was pinged so we know it's up

    // Create or verify the index works
    app.services.elastic.ensure((err) => {
        if (err) {
            console.error('Failed to ensure our index in elasticsearch', err);
            process.exit(1);
        } else {

            app.services.elastic.search({
                query: {
                    match_all: {}
                },
                size: 5
            }, (err, res) => {
                if (err) {
                    console.error('Failed to query elasticsearch', err);
                    process.exit(2);
                } else {
                    console.log(`Search matched ${res.hits.total} total docs, returned ${res.hits.hits.length} docs`);
                    process.exit(0);
                }
            })
        }
    });

});