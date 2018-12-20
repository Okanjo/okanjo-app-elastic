"use strict";

const ElasticSearch = require('elasticsearch');
const Async = require('async');
const Minimatch = require('minimatch');

/**
 * Elasticsearch Service
 */
class ElasticService {

    /**
     * Constructor
     * @param app - OkanjoApp
     * @param config – ElasticSearch Client configuration
     * @param index – Index configuration
     */
    constructor(app, config, index) {

        // Hold the app reference and config
        this.app = app;
        this.config = config || app.config.elasticsearch;

        // Backwards compat config, but index should be removed from connection config
        index = index || this.config.index;
        this.index = index.name;
        this.schema = index.schema;
        this.types = index.types;

        // Elastic Stuff
        this.client = new ElasticSearch.Client(this.config);
        this.app._serviceConnectors.push((next) => {
            this.ping(next);
        });
    }

    /**
     * Check if the index exists or not
     * @param {ElasticService~existsCallback} callback
     */
    exists(callback) {
        this.client.indices.exists({
            index: this.index
        }, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Exists: Elasticsearch is down?', err, res, status, this.index);
                callback(err, false);
            } else {
                callback(null, res === true);
            }
        });
    }

    /**
     * Pings the elasticsearch connection/cluster, and checks if we're good to go
     * @param {ElasticService~pingCallback} callback
     */
    ping(callback) {
        this.client.ping({
            requestTimeout: 30000 // 30s to ping it
        }, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Ping: Elasticsearch is down?', err, res, status);
            }
            callback(err, res === true);
        });
    }

    /**
     * Creates the index
     * @param {*} options
     * @param {ElasticService~createCallback} callback
     */
    create(options, callback) {
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        const index = options.index || this.index;
        const body = options.schema !== undefined ? (options.schema || undefined) : this.schema;

        this.client.indices.create({
            index,
            body
        }, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Create: Elasticsearch is down or operation failed', err, res, status, this.index);
            }
            callback(err, status === 200, res);
        });
    }

    //noinspection ReservedWordAsName
    /**
     * Deletes the index and eats errors if the index is already gone
     * @param {ElasticService~deleteCallback} callback
     */
    delete(callback) {
        this.client.indices.delete({
            index: this.index
        }, (err, res, status) => {
            /* istanbul ignore next: out of scope */
            if (status !== 200 && status !== 404 && err) {
                this.app.report('Delete: Elasticsearch is down?', err, res, status, this.index);
                callback(err, false, status, res);
            } else {
                callback(null, status === 200 || status === 400, status, res);
            }
        });
    }

    /**
     * Gets the current index doc type mappings
     * @param {ElasticService~standardCallback} callback
     */
    getMappings(callback) {
        this.client.indices.getMapping({
            index: this.index
        }, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Get Mappings: Elastic search broke?', err, res, status);
            }
            callback(err, res, status);
        });
    }

    /**
     * Gets the current index settings
     * @param {ElasticService~standardCallback} callback
     */
    getSettings(callback) {
        this.client.indices.getSettings({
            index: this.index
        }, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Get Settings: Elastic search broke?', err, res, status);
            }
            callback(err, res, status);
        });
    }

    /**
     * Close an index to remove its overhead from the cluster. Closed index is blocked for read/write operations.
     * @param {ElasticService~openCloseCallback} callback
     */
    _close(callback) {
        this.client.indices.close({
            index: this.index
        }, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Close Index: Elastic search broke?', err, res, status, this.index);
            }
            callback(err, status === 200, res, status);
        });
    }

    /**
     * Open a closed index, making it available for search.
     * @param {ElasticService~openCloseCallback} callback
     */
    _open(callback) {
        this.client.indices.open({
            index: this.index
        }, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Open Index: Elastic search broke?', err, res, status, this.index);
            }
            callback(err, status === 200, res, status);
        });
    }

    /* istanbul ignore next: Elastic 5 leftovers */
    /**
     * Adds a new doc type mapping to the index
     * @param {string} type – Doc type name defined in the schema
     * @param {ElasticService~putMappingCallback} callback
     * @protected
     */
    _putMapping(type, callback) {
        this.client.indices.putMapping({
            index: this.index,
            type,
            body: this.schema.mappings[type]
        }, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Put Mapping: Elastic search broke?', err, res, status);
            }
            callback(err, status === 200, res);
        });
    }

    /**
     * Adds a new analyzer to the index
     * @param {string} analyzerName – Analzyer name defined in the schema
     * @param {ElasticService~putMappingCallback} callback
     * @protected
     */
    _putAnalyzer(analyzerName, callback) {
        const payload = {
            analysis: {
                analyzer: {

                }
            }
        };

        payload.analysis.analyzer[analyzerName] = this.schema.settings.analysis.analyzer[analyzerName];

        this.client.indices.putSettings({
            index: this.index,
            body: payload
        }, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Put Settings: Elastic search broke?', err, res, status);
            }
            callback(err, status === 200, res);
        });
    }

    /**
     * Adds a new field to a doc type in the index
     * @param {string} type – Doc type name
     * @param {string} field – Property name
     * @param {ElasticService~putMappingCallback} callback
     * @protected
     */
    _putMappingField(type, field, callback) {

        const payload = {
            properties: {}
        };

        payload.properties[field] = this.schema.mappings[type].properties[field];

        this.client.indices.putMapping({
            index: this.index,
            type,
            body: payload
        }, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Put Mapping Field: Elastic search broke?', err, res, status);
            }
            callback(err, status === 200, res);
        });
    }

    /**
     * Add or replaces a dynamic field mapping
     * @param {string} type - Doc type name
     * @param {ElasticService~putMappingCallback} callback
     * @protected
     */
    _putDynamicTemplate(type, callback) {

        // Send all type mappings, cuz partial updates are no longer supported (All or nothing in 5.0)
        const payload = {
            dynamic_templates: this.schema.mappings[type].dynamic_templates
        };

        this.client.indices.putMapping({
            index: this.index,
            type,
            body: payload
        }, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Put Dynamic Template: Elastic search broke?', err, res, status);
            }
            callback(err, status === 200, res);
        });
    }


    /**
     * Flattens a mapping into a glob-able set of properties
     * @param {string} prefix - Property name
     * @param {object} obj - Mapping definition
     * @param [toReturn] - Don't set
     * @return {object}
     */
    static flattenProps(prefix, obj, toReturn) {
        toReturn = toReturn || {};

        // add core type
        // e.g. "name": { type: string }
        if (obj.type) {
            toReturn[prefix] = obj;
        }

        // children
        // e.g. "name.first": { type: string }
        if (obj.properties) {
            Object.keys(obj.properties).forEach((prop) => {
                ElasticService.flattenProps(prefix+"."+prop, obj.properties[prop], toReturn);
            });
        }

        return toReturn;
    }

    /**
     * Checks if the given property might be handled by a dynamic definition
     * @param {string} type
     * @param {string} propertyName
     * @param {string} actualProperty
     * @return {boolean}
     * @private
     */
    _isThisPerhapsADynamicField(type, propertyName, actualProperty) {
        // match_mapping_type, √match, √match_pattern, √unmatch, path_match, path_unmatch

        // Check each type
        const dynamic_templates = (this.schema.mappings[type].dynamic_templates || []).map((t) => t[Object.keys(t)[0]]);
        const flatProperty = ElasticService.flattenProps(propertyName, actualProperty);
        //const _prop = {}; _prop[propertyName] = actualProperty;
        //const flatProperty = ElasticService.flatten(_prop);
        //const field = flatProperty[path];

        return dynamic_templates.find((template) => {

            // check match
            if (template.match) {
                if (template.match_pattern) {
                    if (!(new RegExp(template.match)).test(propertyName)) return false;
                } else {
                    if (!Minimatch(propertyName, template.match)) return false;
                }
            }

            // check unmatch
            if (template.unmatch) {
                if (Minimatch(propertyName, template.unmatch)) return false;
            }

                // check path_match
            let props = Object.keys(flatProperty);

            if (template.path_match) {
                props = props.filter((prop) => Minimatch(prop, template.path_match));
                if (props.length === 0) return false;
            }

            // check path_unmatch
            if (template.path_unmatch) {
                props = props.filter((prop) => !Minimatch(prop, template.path_unmatch));
                if (props.length === 0) return false;
            }

            // check match_mapping_type
            if (template.match_mapping_type && actualProperty.type) {
                if (template.match_mapping_type === "string") {
                    // text, keyword, string
                    if (!(new Set(['string','keyword','text'])).has(actualProperty.type)) return false;
                } else if (template.match_mapping_type !== "*") {
                    // as-is
                    if (template.match_mapping_type !== actualProperty.type) return false;
                }
                // otherwise * matches everything
            }

            // all conditions passed, this must apply!
            return true;

        }) !== undefined;
    }

    /**
     * Checks the consistency between what's live in the index and what's defined in the schema.
     * Will add new mappings and types if not present and warn about inconsistencies.
     * @param {ElasticService~checkMappingCallback} callback
     */
    _checkMappingConsistency(callback) {
        this.getMappings((err, res) => {
            /* istanbul ignore if: out of scope */
            if (err) callback(err, false); else {
                /* istanbul ignore if: out of scope */
                if (!res[this.index] || !res[this.index].mappings) {
                    this.app.report('Index mappings are jacked?', res, this.index);
                    callback(new Error('Jacked index - missing index or mappings'), false, 0);
                } else {
                    // For each type
                    const actualMappings = res[this.index].mappings;
                    const expectedMappings = this.schema.mappings;
                    const checkedTypes = new Set();
                    const tasks = [];
                    let consistent = true;

                    Object.keys(expectedMappings).forEach((type) => {
                        /* istanbul ignore if: Elastic 5 leftovers */
                        if (!actualMappings[type]) {
                            // New type!
                            tasks.push((next) => {
                                // Create the entire type mapping
                                this.app.log(` >> Adding elasticsearch index doc type: ${this.index}.${type}`);
                                this._putMapping(type, (err, success) => {
                                    next(err || !success);
                                });
                            });
                            checkedTypes.add(type);
                        } else {
                            // Existing type!

                            // Check dynamic templates
                            const expectedDynamicTemplates = expectedMappings[type].dynamic_templates;
                            const actualDynamicTemplates = actualMappings[type].dynamic_templates;
                            const checkedDynamicTemplates = new Set();

                            if (expectedDynamicTemplates && (!actualDynamicTemplates || actualDynamicTemplates.length === 0)) {
                                // New dynamic templates (all)
                                expectedDynamicTemplates.forEach((template) => {
                                    const templateName = Object.keys(template)[0];

                                    tasks.push((next) => {
                                        // Create the entire dynamic template
                                        this.app.log(` >> Adding elasticsearch index dynamic template: ${this.index}.${type} -> ${templateName}`);
                                        this._putDynamicTemplate(type, (err, success) => {
                                            next(err || !success);
                                        });
                                    });

                                    checkedDynamicTemplates.add(templateName);
                                });
                            } else {
                                /* istanbul ignore else: case handled after this with actual vs checked */
                                if (expectedDynamicTemplates && actualDynamicTemplates) {
                                    // Dynamic templates present in both - diff
                                    expectedDynamicTemplates.forEach((template) => {
                                        const templateName = Object.keys(template)[0];
                                        const actualTemplate = actualDynamicTemplates.find((template) => Object.keys(template)[0] === templateName);

                                        if (!actualTemplate) {
                                            // Not present, add it
                                            tasks.push((next) => {
                                                // Create the entire dynamic template
                                                this.app.log(` >> Adding elasticsearch index dynamic template: ${this.index}.${type} -> ${templateName}`);
                                                this._putDynamicTemplate(type, (err, success) => {
                                                    next(err || !success);
                                                });
                                            });
                                            checkedDynamicTemplates.add(templateName);
                                        } else {
                                            // Diff check

                                            const fields = 'match,match_pattern,unmatch,path_match,path_unmatch'.split(',');

                                            // check fields
                                            const diffFields = fields.filter((field) => {
                                                return template[templateName][field] !== actualTemplate[templateName][field];
                                            });

                                            // check mappings
                                            const mapCheck = this._checkMappingField(template[templateName].mapping, actualTemplate[templateName].mapping, templateName);
                                            if (!mapCheck.consistent) consistent = false;

                                            if (mapCheck.propertyInconstent.length > 0 || diffFields.length > 0) {
                                                this.app.report(
                                                    `Warning: Dynamic mapping definition changed! A complete reindex is the only way to update the mapping! ${this.index}.${type}.${templateName}!`,
                                                    {
                                                        expected: template[templateName],
                                                        actual: actualTemplate[templateName],
                                                        failedProperties: diffFields,
                                                        reason: mapCheck.propertyInconstent || "Properties failed to match"
                                                    }
                                                );
                                                consistent = false;
                                            }
                                        }
                                        checkedDynamicTemplates.add(templateName);
                                    });
                                }
                            }

                            const deadMappings = (actualDynamicTemplates || []).map((template) => Object.keys(template)[0]).filter((mappingName) => !checkedDynamicTemplates.has(mappingName));
                            if (deadMappings.length > 0) {
                                this.app.report(`Warning: Dynamic templates were removed from schema but still exist in index: ${this.index}.${type} -> ${deadMappings.join(', ')}`);
                                consistent = false;
                            }

                            // Check each property
                            const actualProperties = actualMappings[type].properties;
                            const expectedProperties = expectedMappings[type].properties;
                            const checkedProperties = new Set();
                            Object.keys(expectedProperties).forEach((property) => {
                                if (!actualProperties[property]) {
                                    // New property!
                                    tasks.push((next) => {
                                        // Create the individual mapping field
                                        this.app.log(` >> Adding elasticsearch index field: ${this.index}.${type}.${property}`);
                                        this._putMappingField(type, property, (err, success) => {
                                            next(err || !success);
                                        });
                                    });
                                    checkedProperties.add(property);
                                } else {
                                    // Existing property!

                                    // Check consistency
                                    const mapCheck = this._checkMappingField(expectedProperties[property], actualProperties[property], property);
                                    if (!mapCheck.consistent) consistent = false;
                                    if (mapCheck.propertyInconstent.length > 0) {
                                        this.app.report(`Warning: Mapping definition changed! A complete reindex is the only way to update the mapping! ${this.index}.${type}.${property}!`, { expected: expectedProperties[property], actual: actualProperties[property], reason: mapCheck.propertyInconstent });
                                    }

                                    checkedProperties.add(property);
                                }
                            });

                            // Check for remnant properties
                            const deadProperties = Object.keys(actualProperties).filter((property) => !checkedProperties.has(property) && !this._isThisPerhapsADynamicField(type, property, actualProperties[property]));
                            if (deadProperties.length > 0) {
                                this.app.report(`Warning: Properties were removed from schema but still exist in index: ${this.index}.${type} -> ${deadProperties.join(', ')}`);
                                consistent = false;
                            }

                            checkedTypes.add(type);
                        }
                    });


                    // Check for remnant properties
                    const deadTypes = Object.keys(res[this.index].mappings).filter((type) => !checkedTypes.has(type));
                    /* istanbul ignore if: Elastic 5 leftovers */
                    if (deadTypes.length > 0) {
                        this.app.report(`Warning: Doc types were removed from schema but still exist in index: ${this.index} -> ${deadTypes.join(', ')}`);
                        consistent = false;
                    }

                    // Are there new fields/types that need to be created?
                    if (tasks.length > 0) {
                        this.app.log(` > ${tasks.length} elastic index mapping tasks to perform...`);
                        Async.series(tasks, (err) => {
                            /* istanbul ignore if: out of scope */
                            if (err) consistent = false;
                            callback(err, consistent, tasks.length);
                        });
                    } else {
                        // Done - no sync tasks
                        callback(null, consistent, tasks.length);
                    }
                }
            }
        });
    }

    //noinspection JSMethodCanBeStatic
    /**
     * Normalizes the index value to a comparable value
     * @param type - Mapping type
     * @param val - Index value
     * @return {boolean}
     * @private
     */
    _normalizeIndexValue(type, val) {
        // elasticsearch 2.4: no = not indexed at all, not_analyzed = indexed as is, analyzed = converted
        // elasticsearch 5.0: true or false
        if (typeof val === "boolean") {
            return val;
        } else /*istanbul ignore next: elastic 2.4 issue */ if (type === "string") {
            return val === "analyzed"; // treat no === not_analyzed for now as a kludge
        } else {
            return val !== "no";
        }
    }

    /**
     * Checks whether the mapping is consistent with the actual version
     * @param {object} existing - Expected mapping
     * @param {object} actual - Actual mapping
     * @param {string} property - The thing being checked (for debugging)
     * @return {{consistent: boolean, propertyInconstent: string}}
     * @private
     */
    _checkMappingField(existing, actual, property) {
        let propertyInconstent = "";
        let consistent = true;
        if (existing.fields === undefined) {
            // simple mapping
            // only check if field is enabled, otherwise forget it
            if (existing.enabled !== false || actual.enabled !== false) {
                /* istanbul ignore next: Elastic 5 leftovers */
                if (existing.type !== actual.type ||
                    this._normalizeIndexValue(existing.type, existing.index) !== this._normalizeIndexValue(actual.type, actual.index) ||
                    existing.analyzer !== actual.analyzer ||
                    (existing.include_in_all && !actual.include_in_all) ||
                    (!existing.include_in_all && actual.include_in_all)
                ) {
                    propertyInconstent += "Basic field type/index/analyizer/include_in_all mismatch; ";
                    consistent = false;
                }
            }
        } else {
            // complex mapping

            /* istanbul ignore next: Elastic 5 leftovers */
            if (//existing.type !== actual.type ||
            //existing.index !== actual.index ||
            //existing.analyzer !== actual.analyzer ||
            (existing.include_in_all && !actual.include_in_all) ||
            (!existing.include_in_all && actual.include_in_all)
            ) {
                propertyInconstent += "Complex field type/index/analyzer/include_in_all mismatch; (" + property + ")";
                consistent = false;
            }

            const checkedFields = new Set();
            Object.keys(existing.fields).forEach((field) => {

                if (!actual || !actual.fields || !actual.fields[field]) {
                    // field does not exist!
                    propertyInconstent += "Multi-field field missing: " + field + '; ';
                    consistent = false;
                    checkedFields.add(field);
                } else {
                    // field exists - verify settings
                    if (existing.fields[field].type !== actual.fields[field].type ||
                        existing.fields[field].index !== actual.fields[field].index ||
                        existing.fields[field].analyzer !== actual.fields[field].analyzer
                    ) {
                        propertyInconstent += "Multi-field type/index/analyzer mismatch; ("+property+"."+field+")";
                        consistent = false;
                        checkedFields.add(field);
                    } else {
                        // Field OK
                        checkedFields.add(field);
                    }
                }
            });

            // Check for left overs
            const deadFields = Object.keys(actual.fields || []).filter((field) => !checkedFields.has(field));
            if (deadFields.length > 0) {
                propertyInconstent += "Multi-field(s) removed from the schema but still exists in the index: " + deadFields.join(', ');
                consistent = false;
            }
        }
        return { consistent, propertyInconstent };
    }

    /**
     * Checks the consistency of settings (Analyzers) between what's live in the index and what's defined in the schema.
     * @param {ElasticService~checkMappingCallback} callback
     */
    _checkSettingsConsistency(callback) {
        this.getSettings((err, res) => {
            /* istanbul ignore if: out of scope */
            if (err) callback(err, false); else {
                /* istanbul ignore if: out of scope */
                if (!res[this.index] || !res[this.index].settings || !res[this.index].settings.index) {
                    this.app.report('Index settings are jacked?', res, this.index);
                    callback(new Error('Jacked index - missing index or mappings'), false, 0);
                } else {
                    const actualSettings = res[this.index].settings.index;
                    const expectedSettings = this.schema.settings;

                    // If there are none, add fake containers so iterators work
                    /* istanbul ignore next: out of scope */
                    if (!actualSettings.analysis) actualSettings.analysis = {};
                    /* istanbul ignore next: out of scope */
                    if (!actualSettings.analysis.analyzer) actualSettings.analysis.analyzer = {};

                    // Check analysis stuff
                    let consistent = true;
                    const tasks = [];

                    /* istanbul ignore else: expect that most of the time we're going to have schemas with analzers */
                    if (expectedSettings && expectedSettings.analysis && expectedSettings.analysis.analyzer) {
                        const checkedAnalyzers = new Set();
                        Object.keys(expectedSettings.analysis.analyzer).forEach((analyzer) => {
                            if (!actualSettings.analysis.analyzer[analyzer]) {
                                // Not present - Add it!
                                tasks.push((next) => {
                                    this.app.log(` >> Adding index analyzer: ${analyzer}`);
                                    this._putAnalyzer(analyzer, (err, success) => {
                                        next(err || !success);
                                    });
                                });
                                checkedAnalyzers.add(analyzer);
                            } else {
                                // Exists - verify consistency
                                if (expectedSettings.analysis.analyzer[analyzer].type !== actualSettings.analysis.analyzer[analyzer].type ||
                                    [].concat(expectedSettings.analysis.analyzer[analyzer].char_filter).join() !== [].concat(actualSettings.analysis.analyzer[analyzer].char_filter).join() ||
                                    expectedSettings.analysis.analyzer[analyzer].tokenizer !== actualSettings.analysis.analyzer[analyzer].tokenizer ||
                                    [].concat(expectedSettings.analysis.analyzer[analyzer].filter).join() !== [].concat(actualSettings.analysis.analyzer[analyzer].filter).join()
                                ) {
                                    // Different!
                                    this.app.report(`Warning: Analyzer definition changed! A complete reindex is the only way to update the analyzer! ${this.index}.settings.analysis.analyzer.${analyzer}!`, { expected: expectedSettings.analysis.analyzer[analyzer], actual: actualSettings.analysis.analyzer[analyzer] });
                                    consistent = false;
                                }
                                checkedAnalyzers.add(analyzer);
                            }
                        });

                        const deadAnalyzers = Object.keys(actualSettings.analysis.analyzer).filter((analyzer) => !checkedAnalyzers.has(analyzer));
                        if (deadAnalyzers.length > 0) {
                            this.app.report(`Warning: Analyzers were removed from schema but still exist in index: ${this.index} -> ${deadAnalyzers.join(', ')}`);
                            consistent = false;
                        }

                        // Add new analyzers, if any
                        if (tasks.length > 0) {
                            this.app.log(` > ${tasks.length} elastic index settings tasks to perform...`);

                            // Close the index before applying settings
                            this._close((err, closed) => {
                                /* istanbul ignore if: out of scope */
                                if (err || !closed) {
                                    // We are in a bad state here - cuz the index might be closed!
                                    callback(err || new Error('Failed to close index!'), false, tasks.length);
                                } else {
                                    // Run tasks
                                    Async.series(tasks, (err) => {
                                        // If there was a task error, flag as inconsistent
                                        /* istanbul ignore if: out of scope */
                                        if (err) consistent = false;

                                        // Reopen the index after settings applied
                                        this._open((err, opened) => {
                                            /* istanbul ignore if: out of scope */
                                            if (err || !opened) {
                                                callback(err || new Error('Failed to re-open index after adding settings!'), false, tasks.length);
                                            } else {
                                                callback(err, consistent, tasks.length);
                                            }
                                        });
                                    });
                                }
                            });

                        } else {
                            // Done - no sync tasks
                            callback(null, consistent, tasks.length);
                        }
                    } else {
                        callback(null, consistent, 0);
                    }
                }
            }
        });
    }

    /**
     * Creates or verifies the index matches the given schema
     * @param {ElasticService~ensureCallback} callback
     */
    ensure(callback) {

        // Guilty until proven innocent
        let settingsConsistent = false, mappingsConsistent = false;

        // Start the flow
        Async.waterfall([

            // Index exists?
            (next) => {
                this.exists((err, exists) => next(err, exists));
            },

            // Create if not exists
            (exists, next) => {
                if (!exists) {
                    this.create((err/*, success*/) => next(err, exists));
                } else {
                    next(null, exists);
                }
            },

            // Check settings consistency
            (exists, next) => {
                if (exists) {
                    this._checkSettingsConsistency((err, success) => {
                        settingsConsistent = success;
                        next(err, exists);
                    });
                } else {
                    settingsConsistent = true;
                    next(null, exists);
                }
            },

            // Check mappings consistency
            (exists, next) => {
                if (exists) {
                    this._checkMappingConsistency((err, success) => {
                        mappingsConsistent = success;
                        next(err, exists);
                    });
                } else {
                    mappingsConsistent = true;
                    next(null, exists);
                }
            }

        ], (err, exists) => {
            callback(err, settingsConsistent && mappingsConsistent, !exists, settingsConsistent, mappingsConsistent);
        });
    }

    /**
     * Search for documents
     * @param {object} body - Query body
     * @param {object} [options] - Additional search options (like type:"myType" or scroll:'5m')
     * @param {ElasticService~standardCallback} callback
     */
    search(body, options, callback) {

        const payload = {
            index: this.index,
            body
        };

        // Options are optional!
        if (typeof options === "function") {
            callback = options;
            options = {};
        } else {
            // Copy options on top of payload (override)
            Object.keys(options).forEach((key) => {
                payload[key] = options[key];
            });
        }

        this.client.search(payload, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Search: Elasticsearch blew up?', err, res, status, payload);
            }
            callback(err, res, status);
        });
    }

    /**
     * Scrolls through an open search cursor
     * @param {string} scrollId – The active scroll id
     * @param {object} [options] - scroll options (scroll defaults to '5m')
     * @param {ElasticService~standardCallback} callback
     */
    scroll(scrollId, options, callback) {

        const payload = {
            scroll_id: scrollId,
            scroll: '5m'
        };

        // Options are optional!
        if (typeof options === "function") {
            callback = options;
            options = {};
        } else {
            // Copy options on top of payload (override)
            Object.keys(options).forEach((key) => {
                payload[key] = options[key];
            });
        }

        this.client.scroll(payload, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Scroll: Elasticsearch blew up?', err, res, status, payload);
            }
            callback(err, res, status);
        });
    }

    /**
     * Cleans up an open scroll cursor resources
     * @param {string} scrollId - The active scroll id to clear
     * @param {ElasticService~standardCallback} callback
     */
    clearScroll(scrollId, callback) {

        const payload = {
            scrollId
        };

        //noinspection JSCheckFunctionSignatures - not our function
        this.client.clearScroll(payload, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Clear Scroll: Elasticsearch blew up?', err, res, status, payload);
            }
            callback(err, res, status);
        });
    }

    /**
     * Sends a batch of operations to the index
     * @param {*} body – The raw bulk body
     * @param {object} [options] - Additional bulk options (like type:'myType', timeout defaults to '5m')
     * @param {ElasticService~standardCallback} callback
     */
    bulk(body, options, callback) {
        const payload = {
            index: this.index,
            body,
            timeout: '5m',
            refresh: 'wait_for'
        };

        // Options are optional!
        if (typeof options === "function") {
            callback = options;
            options = {};
        } else {
            // Copy options on top of payload (override)
            Object.keys(options).forEach((key) => {
                payload[key] = options[key];
            });
        }

        this.client.bulk(payload, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Bulk: Elasticsearch blew up?', err, res, status, payload);
            }
            callback(err, res, status);
        });
    }

    //noinspection ReservedWordAsName
    /**
     * Gets a document given its id.
     * @param {string} id - Document id
     * @param {object} [options] - Optional options, like `type`
     * @param {ElasticService~standardCallback} callback
     */
    get(id, options, callback) {
        const payload = {
            index: this.index,
            type: '_all',
            id
        };

        // Options are optional!
        if (typeof options === "function") {
            callback = options;
            options = {};
        } else {
            // Copy options on top of payload (override)
            Object.keys(options).forEach((key) => {
                payload[key] = options[key];
            });
        }

        this.client.get(payload, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err && status !== 404) {
                this.app.report('Get: Elasticsearch blew up?', err, res, status, payload);
            } else if (status === 404) {
                // Eat the error
                err = null;
                res = null;
            }
            callback(err, res, status);
        });
    }

    /**
     * Adds or updates an index template
     * @param name
     * @param patterns
     * @param schema
     * @param options
     * @param callback
     */
    putTemplate(name, patterns, schema, options, callback) {
        const payload = {};
        if (typeof options === "function") {
            callback = options;
            options = {};
        } else {
            // Copy options on top of payload (override)
            Object.keys(options).forEach((key) => {
                payload[key] = options[key];
            });
        }

        payload.name = name;
        payload.body = this.app.copy({}, schema);

        /* istanbul ignore next: elastic 6.x broke templates by changing `template to index_patterns` */
        if (!this.config.apiVersion || parseFloat(this.config.apiVersion) >= 6.0) {
            payload.body.index_patterns = patterns;
        } else {
            if (patterns.length > 1) {
                // More than one template wildcard defined, we must explode
                const err = new Error('Breaking Change: Elastic 5.x and older does not support multiple template wildcard patterns');
                this.app.report(err);
                return callback(err);
            } else {
                payload.body.template = patterns.join('');
            }
        }

        this.client.indices.putTemplate(payload, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Failed to add/update index template', err, {res,status,payload});
            }
            callback(err, res, status);
        });
    }

    /**
     * Removes an index template
     * @param name
     * @param callback
     */
    deleteTemplate(name, callback) {
        const payload = {
            name
        };
        this.client.indices.deleteTemplate(payload, (err, res, status) => {
            /* istanbul ignore if: out of scope */
            if (err) {
                this.app.report('Failed to remove index template', err, {res,status,payload});
            }
            callback(err, res, status);
        });
    }
}

module.exports = ElasticService;

/**
 * Exists operation callback
 * @callback ElasticService~existsCallback
 * @param {Error} err – Whether the operation failed
 * @param {boolean} live – Whether the connection is live
 */

/**
 * Ping operation callback
 * @callback ElasticService~pingCallback
 * @param {Error} err – Whether the operation failed
 * @param {boolean} live – Whether the connection is live
 */

/**
 * Create operation callback
 * @callback ElasticService~createCallback
 * @param {Error} err – Whether the operation failed
 * @param {boolean} success – Whether the connection is live
 * @param {object} res – The raw request response
 */

/**
 * Delete operation callback
 * @callback ElasticService~deleteCallback
 * @param {Error} err – Whether the operation failed
 * @param {boolean} success – Whether the index was deleted or doesn't exist
 * @param {number} status - The raw status code of the operation response (if 200, it was *just* deleted)
 * @param {object} res – The raw request response
 */

/**
 * Put mapping callback
 * @callback ElasticService~putMappingCallback
 * @param {Error} err – Whether the operation failed
 * @param {boolean} status - The raw status code of the operation response (if 200, it was *just* deleted)
 * @param {object} res – The raw request response
 */

/**
 * Consistency check callback
 * @callback ElasticService~checkMappingCallback
 * @param {Error} err – Whether the operation failed
 * @param {boolean} [consistent] – Whether the index is consistent with the defined schema
 * @param {number} [tasks] – The number of tasks executed to bring the index up to a consistent state
 */

/**
 * Open/Close index operation callback
 * @callback ElasticService~openCloseCallback
 * @param {Error} err – Whether the operation failed
 * @param {boolean} success – Whether the operation was successful
 * @param {object} res – The raw request response
 * @param {number} status - The raw status code of the operation response (if 200, it was *just* deleted)
 */

/**
 * Ensure the index is consistent with the current schema
 * @callback ElasticService~ensureCallback
 * @param {Error} err – Whether the operation failed
 * @param {boolean} consistent - Whether the index exactly matches the schema state
 * @param {boolean} created - Whether the index was just created
 * @param {boolean} settingsConsistent - Whether the settings are consistent
 * @param {boolean} mappingsConsistent - Whether the mappings are consistent
 */

/**
 * Standard ElasticSearch response
 * @callback ElasticService~standardCallback
 * @param {Error} err – Whether the operation failed
 * @param {object} res – The raw request response
 * @param {number} status - The raw status code of the operation response (if 200, it was *just* deleted)
 */