const should = require('should');

describe('ElasticService', () => {

    const ElasticService = require('../ElasticService');
    const { Client } = require('@elastic/elasticsearch');
    const OkanjoApp = require('okanjo-app');
    const config = require('./config');

    const origTemplate = JSON.stringify(require('./test_schema_template'));

    /**
     * App
     * @type {OkanjoApp}
     */
    let app;

    // Init
    before(function(done) {

        // Create the app instance
        app = new OkanjoApp(config);

        // Add the redis service to the app
        app.services = {
            elastic: new ElasticService(app, config.elasticsearch.client, config.elasticsearch.unit_test_index.index),
            // elastic_better: new ElasticService(
            //     app,
            //     app.copy({}, app.config.elasticsearch_default_cluster),
            //     app.config.elastic_unit_test_index.index
            // )
        };

        app.connectToServices().then(async() => {
            await app.services.elastic.delete(); // main index
            await app.services.elastic.delete({ // remove template-built-index too
                index: 'unit_test_things_1'
            });
            await app.services.elastic.deleteTemplate(app.config.elasticsearch.unit_test_index.template_name);
            done();
        });
    });

    describe('Basic operations', () => {

        it('should be bound to app', function() {
            app.services.elastic.should.be.an.Object();
            app.services.elastic.should.be.instanceof(ElasticService);
        });

        it('can create service given existing client', () => {
            const service = new ElasticService(app, app.services.elastic.client, config.elasticsearch.unit_test_index.index);
            should(service).be.ok();
            should(service.client).be.instanceOf(Client);
        });

        it('should throw if you do not provide a config', () => {
            (() => {
                new ElasticService(app);
            }).should.throw(/configuration/);
        });

        it('should throw if you do not provide an index config', () => {
            (() => {
                new ElasticService(app, config.elasticsearch.client);
            }).should.throw(/configuration/);
        });

        it('ping', async () => {
            const res = await app.services.elastic.ping();
            should(res).be.ok();
        });

        it('exists', async () => {
            const res = await app.services.elastic.exists();
            should(res).not.be.ok();
        });

        it('flatten flattens!', () => {

            ElasticService.flattenProps('manager', {
                "properties": {
                    "age":  { "type": "integer" },
                    "name": {
                        "properties": {
                            "first": { "type": "text" },
                            "last":  { "type": "text" }
                        }
                    }
                }
            }).should.deepEqual({
                "manager.age": {"type":"integer"},
                "manager.name.first":{"type":"text"},
                "manager.name.last":{"type":"text"}
            });

        });

    });

    describe('templates', () => {

        //should add a template
        before(async () => {
            const template = JSON.parse(origTemplate);
            const { statusCode, body } = await app.services.elastic.putTemplate(
                app.config.elasticsearch.unit_test_index.template_name,
                app.config.elasticsearch.unit_test_index.index_patterns,
                template
            );

            body.acknowledged.should.be.exactly(true);
            statusCode.should.be.exactly(200);
        });

        // should delete a template
        after(async () => {
            const { statusCode, body } = await app.services.elastic.deleteTemplate(app.config.elasticsearch.unit_test_index.template_name);
            body.acknowledged.should.be.exactly(true);
            statusCode.should.be.exactly(200);
        });

        it('should update a template', async () => {
            const template = JSON.parse(origTemplate);
            template.mappings.my_thing.properties.new_prop = { type: "long" };
            const { statusCode, body } = await app.services.elastic.putTemplate(
                app.config.elasticsearch.unit_test_index.template_name,
                app.config.elasticsearch.unit_test_index.index_patterns,
                template,
                { create: false }
            );
            body.acknowledged.should.be.exactly(true);
            statusCode.should.be.exactly(200);
        });

        it('should create an index from a template', async () => {
            let success = await app.services.elastic.create({
                index: 'unit_test_things_1',
                schema: null // don't use the configured mappings
            });
            should(success).be.ok();

            // exists?
            success = await app.services.elastic.exists({ index: 'unit_test_things_1' });
            should(success).be.ok();

            // get mappings to verify
            let res = await app.services.elastic.getMappings({
                index: 'unit_test_things_1'
            });
            should(res.body).be.ok();
            should(res.statusCode).be.exactly(200);
            res.body.unit_test_things_1.mappings.my_thing.properties.atom.type.should.be.exactly('long');

            // verify settings
            res = await app.services.elastic.getSettings({
                index: 'unit_test_things_1'
            });
            should(res.body).be.ok();
            should(res.statusCode).be.exactly(200);
            res.body.unit_test_things_1.settings.index.number_of_shards.should.be.exactly('2');

            // delete the test templated index
            success = await app.services.elastic.delete({
                index: 'unit_test_things_1'
            });
            success.should.be.ok();
        });

    });

    describe('bulk', () => {

        before(async function() {
            this.timeout(2000);

            // Create index
            const success = await app.services.elastic.create();
            should(success).be.ok();

            // get mappings to verify
            let res = await app.services.elastic.getMappings();
            should(res.body).be.ok();
            should(res.statusCode).be.exactly(200);
            res.body.unit_test.mappings.my_thing.properties.atom.type.should.be.exactly('long');

            // verify settings
            res = await app.services.elastic.getSettings();
            should(res.body).be.ok();
            should(res.statusCode).be.exactly(200);
            res.body.unit_test.settings.index.number_of_shards.should.be.exactly('2');
        });

        after(async() => {
            // Delete index
            const success = await app.services.elastic.delete();
            should(success).be.ok();
        });


        // noinspection JSAccessibilityCheck
        it('should work', async () => {
            const body = [
                { index: { _id: "doc1" } },
                {
                    my_bool: false,
                    category: "Nope",
                    name: "A Cool my_thing",

                    // category_names
                    category_name_0: "Home",
                    category_name_1: "Garden",

                    // my_categories
                    category_0: "Poop",
                    category_1: "Mouth"

                },

                { index: { _id: "doc2" } },
                {
                    my_bool: true,
                    category: "Yup",
                    name: "A Not Cool my_thing",

                    // category_names
                    category_name_0: "Home",
                    category_name_1: "Office",

                    // my_categories
                    category_0: "Poop",
                    category_1: "Face"
                }
            ];

            const options = {
                type: app.services.elastic.types.my_thing
            };

            const res = await app.services.elastic.bulk(body, options);
            should(res.body).be.an.Object();
            should(res.statusCode).be.exactly(200);

        }).timeout(2000);

        // noinspection JSAccessibilityCheck
        it('should work without options', async () => {
            const body = [
                { index: { _id: "doc3", _type: app.services.elastic.types.my_thing } },
                {
                    my_bool: false,
                    category: "Nope",
                    name: "A Cool my_thing"
                },

                { index: { _id: "doc4", _type: app.services.elastic.types.my_thing } },
                {
                    my_bool: true,
                    category: "Yup",
                    name: "A Not Cool my_thing"
                }
            ];

            const res = await app.services.elastic.bulk(body);
            should(res.body).be.an.Object();
            should(res.statusCode).be.exactly(200);
        }).timeout(2000);

    });

    describe('search', () => {

        before(async function() {
            this.timeout(2000);

            // Create index
            const success = await app.services.elastic.create();
            should(success).be.ok();

            // Index some docs
            const body = [
                { index: { _id: "doc1", _type: app.services.elastic.types.my_thing } },
                {
                    my_bool: false,
                    category: "Nope",
                    name: "A Cool my_thing",

                    // category_names
                    category_name_0: "Home",
                    category_name_1: "Garden",

                    // my_categories
                    category_0: "Poop",
                    category_1: "Mouth"

                },

                { index: { _id: "doc2", _type: app.services.elastic.types.my_thing } },
                {
                    my_bool: true,
                    category: "Yup",
                    name: "A Not Cool my_thing",

                    // category_names
                    category_name_0: "Home",
                    category_name_1: "Office",

                    // my_categories
                    category_0: "Poop",
                    category_1: "Face"
                },

                { index: { _id: "doc3", _type: app.services.elastic.types.my_thing } },
                {
                    my_bool: false,
                    category: "Nope",
                    name: "A Cool my_thing"
                },

                { index: { _id: "doc4", _type: app.services.elastic.types.my_thing } },
                {
                    my_bool: true,
                    category: "Yup",
                    name: "A Not Cool my_thing"
                }
            ];

            const res = await app.services.elastic.bulk(body);
            should(res.body).be.an.Object();
            should(res.statusCode).be.exactly(200);
        });

        after(async() => {
            // Delete index
            const success = await app.services.elastic.delete();
            should(success).be.ok();
        });

        it('works without anything', async () => {
            const res = await app.services.elastic.search();
            should(res.statusCode).be.exactly(200);
            should(res.body).be.ok()
        });

        it('returns everything we indexed', async () => {
            const res = await app.services.elastic.search({
                "query": {
                    "match_all": {}
                }
            });

            should(res.body).be.an.Object();
            should(res.statusCode).be.exactly(200);

            should(res.body.hits.total).be.exactly(4);
        });

        it('returns everything we indexed with options', async () => {
            const res = await app.services.elastic.search(
                {
                    "query": {
                        "match_all": {}
                    }
                },
                { type: app.services.elastic.types.my_thing }
            );
            should(res.body).be.an.Object();
            should(res.statusCode).be.exactly(200);

            should(res.body.hits.total).be.exactly(4); // since types are dead we get 4 instead of 2
        });
    });

    describe('scroll', () => {

        before(async function() {
            this.timeout(2000);

            // Create index
            const success = await app.services.elastic.create();
            should(success).be.ok();

            // Index some docs
            const body = [
                { index: { _id: "doc1", _type: app.services.elastic.types.my_thing } },
                {
                    my_bool: false,
                    category: "Nope",
                    name: "A Cool my_thing",

                    // category_names
                    category_name_0: "Home",
                    category_name_1: "Garden",

                    // my_categories
                    category_0: "Poop",
                    category_1: "Mouth"

                },

                { index: { _id: "doc2", _type: app.services.elastic.types.my_thing } },
                {
                    my_bool: true,
                    category: "Yup",
                    name: "A Not Cool my_thing",

                    // category_names
                    category_name_0: "Home",
                    category_name_1: "Office",

                    // my_categories
                    category_0: "Poop",
                    category_1: "Face"
                },

                { index: { _id: "doc3", _type: app.services.elastic.types.my_thing } },
                {
                    my_bool: false,
                    category: "Nope",
                    name: "A Cool my_thing"
                },

                { index: { _id: "doc4", _type: app.services.elastic.types.my_thing } },
                {
                    my_bool: true,
                    category: "Yup",
                    name: "A Not Cool my_thing"
                }
            ];

            const res = await app.services.elastic.bulk(body);
            should(res.body).be.an.Object();
            should(res.statusCode).be.exactly(200);
        });

        after(async() => {
            // Delete index
            const success = await app.services.elastic.delete();
            should(success).be.ok();
        });

        it('scrolls through all records', async () => {
            const ids = new Set();

                // Search -> 1
            let res = await app.services.elastic.search(
                {
                    query: {
                        match_all: {}
                    },
                    size: 1 // one at a time
                },
                { scroll: '1m' } // Ask for a scroll id
            );

            should(res.body).be.an.Object();
            should(res.statusCode).be.exactly(200);

            should(res.body._scroll_id).be.a.String();
            let scroll_id = res.body._scroll_id;

            should(res.body.hits.total).be.exactly(4);
            should(res.body.hits.hits.length).be.exactly(1);

            ids.add(res.body.hits.hits[0]._id);

            // Scroll -> 2
            res = await app.services.elastic.scroll(scroll_id); // let it use the default option set
            should(res.body).be.an.Object();
            should(res.statusCode).be.exactly(200);

            should(res.body._scroll_id).be.a.String();
            scroll_id = res.body._scroll_id;

            should(res.body.hits.total).be.exactly(4);
            should(res.body.hits.hits.length).be.exactly(1);

            ids.has(res.body.hits.hits[0]._id).should.be.exactly(false);
            ids.add(res.body.hits.hits[0]._id);

            // Scroll -> 3
            res = await app.services.elastic.scroll(scroll_id, { scroll: '1m' }); // Ask for a scroll id
            should(res.body).be.an.Object();
            should(res.statusCode).be.exactly(200);

            should(res.body._scroll_id).be.a.String();
            scroll_id = res.body._scroll_id;

            should(res.body.hits.total).be.exactly(4);
            should(res.body.hits.hits.length).be.exactly(1);

            ids.has(res.body.hits.hits[0]._id).should.be.exactly(false);
            ids.add(res.body.hits.hits[0]._id);

            // Scroll -> 4
            res = await app.services.elastic.scroll(scroll_id,{ scroll: '1m' }); // Ask for a scroll id
            should(res.body).be.an.Object();
            should(res.statusCode).be.exactly(200);

            should(res.body._scroll_id).be.a.String();
            scroll_id = res.body._scroll_id;

            should(res.body.hits.total).be.exactly(4);
            should(res.body.hits.hits.length).be.exactly(1);

            ids.has(res.body.hits.hits[0]._id).should.be.exactly(false);
            ids.add(res.body.hits.hits[0]._id);

            // Clear Scroll
            res = await app.services.elastic.clearScroll(scroll_id);
            should(res.body).be.an.Object();
            should(res.statusCode).be.exactly(200);
        });

    });

    describe('get', () => {

        before(async function() {
            this.timeout(2000);

            // Create index
            const success = await app.services.elastic.create();
            should(success).be.ok();

            // Index some docs
            const body = [
                { index: { _id: "doc1", _type: app.services.elastic.types.my_thing } },
                {
                    my_bool: false,
                    category: "Nope",
                    name: "A Cool my_thing",

                    // category_names
                    category_name_0: "Home",
                    category_name_1: "Garden",

                    // my_categories
                    category_0: "Poop",
                    category_1: "Mouth"

                }
            ];

            const res = await app.services.elastic.bulk(body);
            should(res.body).be.an.Object();
            should(res.statusCode).be.exactly(200);
        });

        after(async() => {
            // Delete index
            const success = await app.services.elastic.delete();
            should(success).be.ok();
        });

        it('works', async () => {
            const doc = await app.services.elastic.get('doc1');
            should(doc).be.ok();
        });

        it('works with a type', async () => {
            const doc = await app.services.elastic.get('doc1', { type: app.services.elastic.types.my_thing });
            should(doc).be.ok();
        });

        it('works with a type by not returning docs', async () => {
            const doc = await app.services.elastic.get('doc1', { type: "my_thing2" });
            should(doc).be.exactly(null);
        });
    });

});