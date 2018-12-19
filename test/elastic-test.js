const should = require('should'),
    Async = require('async');

describe('ElasticService', () => {

    const ElasticService = require('../ElasticService');
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
            elastic: new ElasticService(app),
            elastic_better: new ElasticService(
                app,
                app.copy({}, app.config.elasticsearch_default_cluster),
                app.config.elastic_unit_test_index.index
            )
        };

        app.connectToServices(() => {
            app.services.elastic.delete(() => {
                // disrgard error - we don't care we just want it gone

                // remove template-built-index too
                app.services.elastic.client.indices.delete({
                    index: 'unit_test_things_1'
                }, () => {
                    // disrgard error - we don't care we just want it gone

                    app.services.elastic.deleteTemplate(app.config.elastic_unit_test_index.template_name, () => {
                        // disrgard error - we don't care we just want it gone
                        done();
                    });
                });
            });
        });
    });


    it('should be bound to app', function() {
        app.services.elastic.should.be.an.Object();
        app.services.elastic.should.be.instanceof(ElasticService);
    });

    it('ping', (done) => {
        app.services.elastic.ping((err) => {
            should(err).not.be.ok();
            done();
        })
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

    it('works with the better config structure', (done) => {

        app.services.elastic_better.ping((err) => {
            should(err).not.be.ok();
            done();
        });

    });

    describe('ensure', () => {
        it('works', (done) => {
            Async.waterfall([
                // first check should create the index
                (next) => {
                    app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                        should(err).not.be.ok();

                        consistent.should.be.exactly(true);
                        created.should.be.exactly(true);
                        settings.should.be.exactly(true);
                        mappings.should.be.exactly(true);

                        next();
                    });
                },

                // a second call should still be consistent but not created
                (next) => {
                    app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                        should(err).not.be.ok();

                        consistent.should.be.exactly(true);
                        created.should.be.exactly(false);
                        settings.should.be.exactly(true);
                        mappings.should.be.exactly(true);

                        next();
                    });
                },

                // ensure it was actually created
                // use the client because we don't want the helper
                // to create it if it didn't get created
                (next) => {
                    app.services.elastic.client.indices.get({
                        index: app.services.elastic.index
                    }, (err) => {
                        should(err).not.be.ok();

                        next();
                    });
                },

                //verify it exists via helper
                (next) => {
                    app.services.elastic.exists((err, exists) => {
                        should(err).not.be.ok();
                        should(exists).be.exactly(true);
                        next();
                    });
                }
            ], done);
        });

        it('should add new mappings', (done) => {

            // Put a new field in the schema
            app.services.elastic.schema.mappings.my_thing.properties.is_new = {
                type: "boolean",
                //include_in_all: false
            };

            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                consistent.should.be.exactly(true);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(true);

                app.services.elastic.getMappings((err, res) => {
                    should(err).not.be.ok();
                    should(res[app.services.elastic.index].mappings.my_thing.properties.is_new).be.an.Object();
                    done();
                });
            });
        });

        // it('should add new types', (done) => {
        //
        //     // Put a new type in the schema
        //     app.services.elastic.types.my_thing2 = "my_thing2";
        //     app.services.elastic.schema.mappings.my_thing2 = {
        //         properties: {
        //             new: {
        //                 type: "boolean",
        //                 //include_in_all: false
        //             },
        //             my_bool: {
        //                 type: "boolean",
        //                 //include_in_all: false
        //             },
        //             category: {
        //                 type: "text",
        //                 analyzer: "snowball",
        //                 fields: {
        //                     raw: {
        //                         type: "keyword"
        //                     },
        //                     lowered: {
        //                         type: "text",
        //                         analyzer: "lowercase_only"
        //                     }
        //                 }
        //             },
        //             name: {
        //                 type: "text",
        //                 analyzer: "html_snowball",
        //                 //include_in_all: true
        //             }
        //         }
        //     };
        //
        //     app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
        //         should(err).not.be.ok();
        //
        //         consistent.should.be.exactly(true);
        //         created.should.be.exactly(false);
        //         settings.should.be.exactly(true);
        //         mappings.should.be.exactly(true);
        //
        //         app.services.elastic.getMappings((err, res) => {
        //             should(err).not.be.ok();
        //             should(res[app.services.elastic.index].mappings.my_thing2).be.an.Object();
        //             done();
        //         });
        //     });
        // });

        it('should add new analyzers', (done) => {

            // Put a new type in the schema
            app.services.elastic.schema.settings.analysis.analyzer.lowercase_only2 = {
                type: "custom",
                char_filter: [],
                tokenizer: "keyword",
                filter: ["lowercase"]
            };

            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                consistent.should.be.exactly(true);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(true);

                app.services.elastic.getSettings((err, res) => {
                    should(err).not.be.ok();
                    should(res[app.services.elastic.index].settings.index.analysis.analyzer.lowercase_only2).be.an.Object();
                    done();
                });
            });
        });

        it('should add new dynamic templates', (done) => {

            // Put a new dynamic template in the schema
            app.services.elastic.schema.mappings.my_thing.dynamic_templates = [];
            app.services.elastic.schema.mappings.my_thing.dynamic_templates.push({
                category_names: {
                    match: "category_name_*",
                    match_mapping_type: "string",
                    mapping: {
                        type: "keyword",
                        //include_in_all: false
                    }
                }
            });

            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                consistent.should.be.exactly(true);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(true);

                app.services.elastic.getMappings((err, res) => {
                    should(err).not.be.ok();
                    should(res[app.services.elastic.index].mappings.my_thing.dynamic_templates).be.an.Array();
                    res[app.services.elastic.index].mappings.my_thing.dynamic_templates.length.should.be.exactly(1);
                    res[app.services.elastic.index].mappings.my_thing.dynamic_templates[0].category_names.should.be.an.Object();
                    done();
                });
            });
        });

        it('should add new dynamic templates with multiple fields', (done) => {

            // Put a new dynamic template in the schema
            app.services.elastic.schema.mappings.my_thing.dynamic_templates.push({
                my_categories: {
                    match: "category_*",
                    match_mapping_type: "string",
                    mapping: {
                        type: "text",
                        analyzer: "snowball",
                        fields: {
                            raw: {
                                type: "keyword"
                            }
                        }
                    }
                }
            });

            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                consistent.should.be.exactly(true);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(true);

                app.services.elastic.getMappings((err, res) => {
                    should(err).not.be.ok();
                    should(res[app.services.elastic.index].mappings.my_thing.dynamic_templates).be.an.Array();
                    res[app.services.elastic.index].mappings.my_thing.dynamic_templates.length.should.be.exactly(2);
                    res[app.services.elastic.index].mappings.my_thing.dynamic_templates[1].my_categories.should.be.an.Object();
                    done();
                });
            });
        });

        it('should handle edge cases with existing fields and dynamic templates', () => {

            // set 1
            app.services.elastic.schema.mappings.my_thing.dynamic_templates.push({
                test: {
                    path_match: 'test_*',
                    path_unmatch: 'test_nope_*',
                    match_mapping_type: 'string'
                }
            });
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'test_prop', { type: 'text' }).should.be.exactly(true);
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'test_nope_exclude_me', { type: 'text' }).should.be.exactly(false);
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'test_wrong_type', { type: 'boolean' }).should.be.exactly(false);
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'not_applicable', { type: 'keyword' }).should.be.exactly(false);
            app.services.elastic.schema.mappings.my_thing.dynamic_templates.pop();

            // set 2
            app.services.elastic.schema.mappings.my_thing.dynamic_templates.push({
                test: {
                    match: 'test_*',
                    unmatch: 'test_nope_*'
                }
            });
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'test_prop', { type: 'text' }).should.be.exactly(true);
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'test_nope_exclude_me', { type: 'text' }).should.be.exactly(false);
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'not_applicable', { type: 'keyword' }).should.be.exactly(false);
            app.services.elastic.schema.mappings.my_thing.dynamic_templates.pop();

            // set 3
            app.services.elastic.schema.mappings.my_thing.dynamic_templates.push({
                test: {
                    match: '^test_[a-zA-Z]+_.*$',
                    match_pattern: 'regex',
                    match_mapping_type: 'boolean'
                }
            });
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'test_prop_1', { type: 'boolean' }).should.be.exactly(true);
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'test-does-not-match', { type: 'boolean' }).should.be.exactly(false);
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'test_wrong_type', { type: 'long' }).should.be.exactly(false);
            app.services.elastic.schema.mappings.my_thing.dynamic_templates.pop();


            // set 4
            app.services.elastic.schema.mappings.my_thing.dynamic_templates.push({
                test: {
                    match_mapping_type: '*'
                }
            });
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'prop', { type: 'boolean' }).should.be.exactly(true);
            app.services.elastic.schema.mappings.my_thing.dynamic_templates.pop();

            // set 5
            const temp = app.services.elastic.schema.mappings.my_thing.dynamic_templates;
            app.services.elastic.schema.mappings.my_thing.dynamic_templates = undefined;
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'prop', { type: 'boolean' }).should.be.exactly(false);
            app.services.elastic.schema.mappings.my_thing.dynamic_templates = temp;


            // set 6
            app.services.elastic.schema.mappings.my_thing.dynamic_templates.push({
                "full_name": {
                    "path_match":   "manager.name.*",
                    "mapping": {
                        "type":       "text",
                        "copy_to":    "full_name"
                    }
                }
            });
            app.services.elastic._isThisPerhapsADynamicField('my_thing', 'manager', {
                "properties": {
                    "age":  { "type": "integer" },
                    "name": {
                        "properties": {
                            "first": { "type": "text" },
                            "last":  { "type": "text" }
                        }
                    }
                }
            }).should.be.exactly(true);
            app.services.elastic.schema.mappings.my_thing.dynamic_templates.pop();
        });

        it('should warn when mappings change', (done) => {
            // app.services.elastic.schema.mappings.my_thing.properties.some_url.include_in_all = true;
            app.services.elastic.schema.mappings.my_thing.properties.is_new.type = "double";
            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                // Revert
                app.services.elastic.schema.mappings.my_thing.properties.is_new.type = "boolean";
                // app.services.elastic.schema.mappings.my_thing.properties.some_url.include_in_all = false;

                consistent.should.be.exactly(false);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(false);

                done();
            });
        });

        it('should warn when `long` mappings change', (done) => {
            app.services.elastic.schema.mappings.my_thing.properties.atom.index = "no";
            app.services.elastic.schema.mappings.my_thing.properties.atom2.index = false;
            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                // Revert
                app.services.elastic.schema.mappings.my_thing.properties.atom.index = "not_analyzed";
                app.services.elastic.schema.mappings.my_thing.properties.atom2.index = "not_analyzed";

                consistent.should.be.exactly(false);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(false);

                done();
            });
        });

        it('should warn when multi-field mappings change', (done) => {
            // app.services.elastic.schema.mappings.my_thing.properties.category.include_in_all = true;
            app.services.elastic.schema.mappings.my_thing.properties.category.fields.lowered.analyzer = "lowercase_only2";
            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                // Revert
                // app.services.elastic.schema.mappings.my_thing.properties.category.include_in_all = false;
                app.services.elastic.schema.mappings.my_thing.properties.category.fields.lowered.analyzer = "lowercase_only";

                consistent.should.be.exactly(false);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(false);

                done();
            });
        });

        it('should warn when multi-field gets a new field', (done) => {
            app.services.elastic.schema.mappings.my_thing.properties.category.fields.lowered2 = app.services.elastic.schema.mappings.my_thing.properties.category.fields.lowered;
            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                // Revert
                const fields = app.services.elastic.schema.mappings.my_thing.properties.category.fields;
                delete fields.lowered2;

                consistent.should.be.exactly(false);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(false);

                done();
            });
        });

        it('should warn when multi-field loses a field', (done) => {
            const original = app.services.elastic.schema.mappings.my_thing.properties.category.fields.lowered;
            const fields = app.services.elastic.schema.mappings.my_thing.properties.category.fields;
            delete fields.lowered;

            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                // Revert
                app.services.elastic.schema.mappings.my_thing.properties.category.fields.lowered = original;

                consistent.should.be.exactly(false);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(false);

                done();
            });
        });

        it('should warn when a property becomes a multi-field', (done) => {
            app.services.elastic.schema.mappings.my_thing.properties.condition.fields = {
                analyzed: {
                    type: "text",
                    analyzer: "snowball"
                }
            };

            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                // Revert
                const prop = app.services.elastic.schema.mappings.my_thing.properties.condition;
                delete prop.fields;

                consistent.should.be.exactly(false);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(false);

                done();
            });
        });

        it('should warn when dynamic templates change', (done) => {
            app.services.elastic.schema.mappings.my_thing.dynamic_templates[0].category_names.match = "category_name__*";
            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                // Revert
                app.services.elastic.schema.mappings.my_thing.dynamic_templates[0].category_names.match = "category_name_*";

                consistent.should.be.exactly(false);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(false);

                done();
            });
        });

        it('should warn when dynamic template fields change', (done) => {
            app.services.elastic.schema.mappings.my_thing.dynamic_templates[1].my_categories.mapping.fields.raw.type = "boolean";
            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                // Revert
                app.services.elastic.schema.mappings.my_thing.dynamic_templates[1].my_categories.mapping.fields.raw.type = "keyword";

                consistent.should.be.exactly(false);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(false);

                done();
            });
        });

        it('should warn when analyzers change', (done) => {
            app.services.elastic.schema.settings.analysis.analyzer.lowercase_only2.char_filter = ["html_strip"];
            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                // Revert
                app.services.elastic.schema.settings.analysis.analyzer.lowercase_only2.char_filter = [];
                consistent.should.be.exactly(false);
                created.should.be.exactly(false);
                settings.should.be.exactly(false);
                mappings.should.be.exactly(true);

                done();
            });
        });

        it('should warn when mappings are removed', (done) => {
            const original = app.services.elastic.schema.mappings.my_thing.properties.is_new;
            const props = app.services.elastic.schema.mappings.my_thing.properties;
            delete props.is_new;

            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                // Revert
                app.services.elastic.schema.mappings.my_thing.properties.is_new = original;

                consistent.should.be.exactly(false);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(false);

                done();
            });
        });

        //
        // it('should warn when types are removed', (done) => {
        //     const original = app.services.elastic.schema.mappings.my_thing2;
        //     const mappings = app.services.elastic.schema.mappings;
        //     delete mappings.my_thing2;
        //
        //     app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
        //         should(err).not.be.ok();
        //
        //         // Revert
        //         app.services.elastic.schema.mappings.my_thing2 = original;
        //
        //         consistent.should.be.exactly(false);
        //         created.should.be.exactly(false);
        //         settings.should.be.exactly(true);
        //         mappings.should.be.exactly(false);
        //
        //         done();
        //     });
        // });

        it('should warn when analyzers are removed', (done) => {
            const original = app.services.elastic.schema.settings.analysis.analyzer.lowercase_only2;
            const analyzer = app.services.elastic.schema.settings.analysis.analyzer;
            delete analyzer.lowercase_only2;

            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                // Revert
                app.services.elastic.schema.settings.analysis.analyzer.lowercase_only2 = original;
                consistent.should.be.exactly(false);
                created.should.be.exactly(false);
                settings.should.be.exactly(false);
                mappings.should.be.exactly(true);

                done();
            });
        });

        it('should warn when dynamic templates are removed', (done) => {
            const original = app.services.elastic.schema.mappings.my_thing.dynamic_templates.pop();

            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                // Revert
                app.services.elastic.schema.mappings.my_thing.dynamic_templates.push(original);

                consistent.should.be.exactly(false);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(false);

                done();
            });
        });

        it('should still ensure with no problems after all the bad things', (done) => {

            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                consistent.should.be.exactly(true);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(true);

                done();
            });
        });

    });

    describe('bulk', () => {

        it('should work', (done) => {
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

            app.services.elastic.bulk(body, options, (err, res, status) => {
                should(err).not.be.ok();
                should(res).be.an.Object();
                should(status).be.exactly(200);

                done();
            });
        }).timeout(2000);

        it('should work without options', (done) => {
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

            app.services.elastic.bulk(body, (err, res, status) => {
                should(err).not.be.ok();
                should(res).be.an.Object();
                should(status).be.exactly(200);

                done();
            });
        }).timeout(2000);

        it('should ensure without complaining about missing fields', (done) => {
            app.services.elastic.ensure((err, consistent, created, settings, mappings) => {
                should(err).not.be.ok();

                consistent.should.be.exactly(true);
                created.should.be.exactly(false);
                settings.should.be.exactly(true);
                mappings.should.be.exactly(true);

                done();
            });
        })

    });

    describe('search', () => {
        it('works without anything', (done) => {
            app.services.elastic.search({}, {}, (err, res, status) => {

                should(err).not.be.ok();
                should(res).be.an.Object();
                should(status).be.exactly(200);

                done();
            });
        });

        it('returns everything we indexed', (done) => {
            app.services.elastic.search({
                "query": {
                    "match_all": {}
                }
            }, (err, res, status) => {


                should(err).not.be.ok();
                should(res).be.an.Object();
                should(status).be.exactly(200);

                should(res.hits.total).be.exactly(4);

                done();
            });
        });

        it('returns everything we indexed with options', (done) => {
            app.services.elastic.search(
                {
                    "query": {
                        "match_all": {}
                    }
                },
                { type: app.services.elastic.types.my_thing },
                (err, res, status) => {


                should(err).not.be.ok();
                should(res).be.an.Object();
                should(status).be.exactly(200);

                should(res.hits.total).be.exactly(4); // since types are dead we get 4 instead of 2

                done();
            });
        });
    });

    describe('scroll', () => {

        it('scrolls through all records', (done) => {
            const ids = new Set();
            Async.waterfall([

                // Search -> 1
                (next) => {
                    app.services.elastic.search(
                        {
                            query: {
                                match_all: {}
                            },
                            size: 1 // one at a time
                        },
                        { scroll: '1m' }, // Ask for a scroll id
                        (err, res, status) => {

                            should(err).not.be.ok();
                            should(res).be.an.Object();
                            should(status).be.exactly(200);

                            should(res._scroll_id).be.a.String();

                            should(res.hits.total).be.exactly(4);
                            should(res.hits.hits.length).be.exactly(1);

                            ids.add(res.hits.hits[0]._id);

                            next(null, res._scroll_id);
                        }
                    );
                },

                // Scroll -> 2
                (scroll_id, next) => {
                    app.services.elastic.scroll(
                        scroll_id,
                        //{ scroll: '1m' }, // let it use the default option set
                        (err, res, status) => {
                            should(err).not.be.ok();
                            should(res).be.an.Object();
                            should(status).be.exactly(200);

                            should(res._scroll_id).be.a.String();

                            should(res.hits.total).be.exactly(4);
                            should(res.hits.hits.length).be.exactly(1);

                            ids.has(res.hits.hits[0]._id).should.be.exactly(false);
                            ids.add(res.hits.hits[0]._id);

                            next(null, res._scroll_id);
                        }
                    );
                },

                // Scroll -> 3
                (scroll_id, next) => {
                    app.services.elastic.scroll(
                        scroll_id,
                        { scroll: '1m' }, // Ask for a scroll id
                        (err, res, status) => {

                            should(err).not.be.ok();
                            should(res).be.an.Object();
                            should(status).be.exactly(200);

                            should(res._scroll_id).be.a.String();

                            should(res.hits.total).be.exactly(4);
                            should(res.hits.hits.length).be.exactly(1);

                            ids.has(res.hits.hits[0]._id).should.be.exactly(false);
                            ids.add(res.hits.hits[0]._id);

                            next(null, res._scroll_id);
                        }
                    );
                },

                // Scroll -> 4
                (scroll_id, next) => {
                    app.services.elastic.scroll(
                        scroll_id,
                        { scroll: '1m' }, // Ask for a scroll id
                        (err, res, status) => {

                            should(err).not.be.ok();
                            should(res).be.an.Object();
                            should(status).be.exactly(200);

                            should(res._scroll_id).be.a.String();

                            should(res.hits.total).be.exactly(4);
                            should(res.hits.hits.length).be.exactly(1);

                            ids.has(res.hits.hits[0]._id).should.be.exactly(false);
                            ids.add(res.hits.hits[0]._id);

                            next(null, res._scroll_id);
                        }
                    );
                },

                // Clear Scroll
                (scroll_id, next) => {
                    app.services.elastic.clearScroll(scroll_id, (err, res, status) => {

                        should(err).not.be.ok();
                        should(res).be.an.Object();
                        should(status).be.exactly(200);

                        next(null);
                    });
                }

            ], done)
        });

    });

    describe('get', () => {
        it('works', (done) => {
            app.services.elastic.get('doc1', (err, res, status) => {
                should(err).not.be.ok();
                should(res).be.an.Object();
                should(status).be.exactly(200);

                done();
            });
        });

        it('works with a type', (done) => {
            app.services.elastic.get('doc1', { type: app.services.elastic.types.my_thing }, (err, res, status) => {
                should(err).not.be.ok();
                should(res).be.an.Object();
                should(status).be.exactly(200);

                done();
            });
        });

        it('works with a type by not returning docs', (done) => {
            app.services.elastic.get('doc1', { type: "my_thing2" }, (err, res, status) => {
                should(err).not.be.ok();
                should(res).be.exactly(null);
                should(status).be.exactly(404);

                done();
            });
        });
    });

    describe('delete', () => {
        it('works', (done) => {
            Async.waterfall([
                // drop the index
                (next) => {
                    app.services.elastic.delete((err, success) => {
                        should(err).not.be.ok();
                        should(success).be.exactly(true);
                        next();
                    })
                },

                // ensure it was actually deleted
                (next) => {
                    app.services.elastic.client.indices.get({
                        index: app.services.elastic.index
                    }, (err, res) => {
                        err.should.be.ok();

                        res.should.be.an.Object();
                        res.error.should.be.an.Object();
                        res.error.reason.should.be.equal('no such index');

                        next();
                    });
                }
            ], done);
        });
    });

    describe('templates', () => {

        it('should add a template', (done) => {
            const template = JSON.parse(origTemplate);
            app.services.elastic.putTemplate(
                app.config.elastic_unit_test_index.template_name,
                app.config.elastic_unit_test_index.index_patterns,
                template,
                (err, res, status) => {

                    should(err).not.be.ok();
                    res.acknowledged.should.be.exactly(true);
                    status.should.be.exactly(200);

                    done();
                }
            );
        });

        it('should update a template', (done) => {
            const template = JSON.parse(origTemplate);
            template.mappings.my_thing.properties.new_prop = { type: "long" };
            app.services.elastic.putTemplate(
                app.config.elastic_unit_test_index.template_name,
                app.config.elastic_unit_test_index.index_patterns,
                template,
                { create: false },
                (err, res, status) => {

                    should(err).not.be.ok();
                    res.acknowledged.should.be.exactly(true);
                    status.should.be.exactly(200);

                    done();
                }
            );
        });

        it('should create an index from a template', (done) => {
            app.services.elastic.create({
                index: 'unit_test_things_1',
                schema: null // don't use the configured mappings
            }, (err, success, res) => {
                should(err).not.be.ok();
                should(success).be.ok();
                res.acknowledged.should.be.exactly(true);

                // get mappings to verify
                app.services.elastic.client.indices.getMapping({
                    index: 'unit_test_things_1'
                }, (err, res, status) => {
                    should(err).not.be.ok();
                    should(res).be.ok();
                    should(status).be.exactly(200);

                    res.unit_test_things_1.mappings.my_thing.properties.atom.type.should.be.exactly('long');

                    // verify settings
                    app.services.elastic.client.indices.getSettings({
                        index: 'unit_test_things_1'
                    }, (err, res, status) => {
                        should(err).not.be.ok();
                        should(res).be.ok();
                        should(status).be.exactly(200);

                        res.unit_test_things_1.settings.index.number_of_shards.should.be.exactly('2');

                        // delete the test templated index
                        app.services.elastic.client.indices.delete({
                            index: 'unit_test_things_1'
                        }, (err, res, status) => {
                            should(err).not.be.ok();
                            res.acknowledged.should.be.exactly(true);
                            status.should.be.exactly(200);

                            done();
                        });
                    });
                });
            });
        });

        it('should delete a template', (done) => {
            app.services.elastic.deleteTemplate(app.config.elastic_unit_test_index.template_name, (err, res, status) => {

                should(err).not.be.ok();
                res.acknowledged.should.be.exactly(true);
                status.should.be.exactly(200);

                done();
            });
        });

    });

});