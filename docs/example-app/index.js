"use strict";

const OkanjoApp = require('okanjo-app');
// const ElasticService = require('okanjo-app-elastic');
const ElasticService = require('../../ElasticService');

const config = require('./config');

const app = new OkanjoApp(config);
app.services = {
    elastic: new ElasticService(app, config.elasticsearch.client, config.elasticsearch.example.index)
};

app.connectToServices().then(async () => {
    // if we got here, elasticsearch was pinged so we know it's up

    // Check if index exists
    console.log('Checking if index is present...');
    const exists = await app.services.elastic.exists();
    console.log(` > Example index: ${!exists ? 'does not exist' : 'exists'}`);

    // Create index
    if (!exists) {
        console.log('Creating example index...');
        await app.services.elastic.create();
        console.log(' > Example index created');
    }

    // Load some docs
    const bulk = [
        { index: { _id: 'fruit1' } },
        {
            name: 'Tomato',
            type: 'fruit',
            description: 'A glossy red, or occasionally yellow, pulpy edible fruit that is eaten as a vegetable or in salad.',
            color: 'red'
        },
        { index: { _id: 'veggie1' } },
        {
            name: 'Potato',
            type: 'veggie',
            description: 'a starchy plant tuber which is one of the most important food crops, cooked and eaten as a vegetable.',
            color: 'brown'
        },
    ];
    console.log('Loading index...');
    const res = await app.services.elastic.bulk(bulk, { type: app.config.elasticsearch.example.index.types._doc });
    console.log(' > Status Code  : %d', res.statusCode);

    // Find all records
    console.log('Retrieving docs...');
    const { statusCode, body } = await app.services.elastic.search({
        query: {
            match_all: {}
        },
        size: 5
    });
    console.log(` > Status Code  : %d`, statusCode);
    console.log(` > Total Records: %d`, body.hits.total);
    console.log(` > Docs: `, body.hits.hits);
    process.exit(0);
});