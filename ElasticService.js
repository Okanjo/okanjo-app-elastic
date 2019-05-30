"use strict";

const EventEmitter = require('events').EventEmitter;

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
        this.config = config;

        if (!this.config) throw new Error('Missing client configuration given to ElasticService');
        if (!index) throw new Error('Missing index configuration given to ElasticService');

        // Is client already setup? Use it instead of creating a new instance
        if (this.config instanceof EventEmitter) {
            this.client = this.config;
        } else {
            const { Client } = require('@elastic/elasticsearch');
            this.client = new Client(this.config)
        }

        this.index = index.name;
        this.schema = index.schema;
        this.types = index.types;

        // Elastic Stuff
        this.app._serviceConnectors.push(async () => {
            await this.ping();
        });
    }

    /**
     * Check if the index exists or not
     * @param {{index:string}} [options] – Options
     * @param options
     * @returns {Promise<boolean>}
     */
    exists(options={}) {
        const { client, index } = this;
        const whichIndex = options.index || index;

        return client.indices
            .exists({
                ...options,
                index: whichIndex
            })
            .then(({ statusCode, body }) => {
                return statusCode === 200 && body === true;
            })
            .catch(/* istanbul ignore next: out of scope */err => {
                this.app.report('ElasticService: Exists: Is Elasticsearch is down?', err, { whichIndex, meta: err.meta });
                return Promise.reject(err);
            })
        ;
    }

    /**
     * Pings the elasticsearch connection/cluster, and checks if we're good to go
     * @returns {Promise<boolean>}
     */
    ping() {
        const { client } = this;
        return client
            .ping()
            .then(({ statusCode, body}) => {
                return statusCode === 200 && body === true
            })
            .catch(/* istanbul ignore next: out of scope */err => {
                this.app.report('ElasticService: Ping: Is Elasticsearch is down?', err);
                return Promise.reject(err);
            })
        ;
    }

    /**
     * Creates a new ElasticSearch index
     * @param {{index:string, schema:object}} [options] – Options
     * @returns {Promise<boolean | never>}
     */
    create(options={}) {
        const { client, index, schema } = this;
        const whichIndex = options.index || index;

        const body = options.schema !== undefined ? (options.schema || undefined): schema; // don't set schema on payload if null/falsey
        delete options.schema;

        return client.indices
            .create({
                ...options,
                index: whichIndex,
                body
            })
            .then(({ statusCode }) => {
                return statusCode === 200;
            })
            .catch(/* istanbul ignore next: out of scope */err => {
                this.app.report('ElasticService: Failed to create index', err, { whichIndex, body, meta: err.meta });
                return Promise.reject(err);
            })
        ;
    }

    //noinspection ReservedWordAsName
    /**
     * Deletes the index and eats errors if the index is already gone
     * @param {{index:string}} [options] – Options
     * @returns {Promise<boolean | never>}
     */
    delete(options={}) {
        const { client, index } = this;
        const whichIndex = options.index || index;

        return client.indices
            .delete({
                ...options,
                index: whichIndex
            })
            .catch(err => {
                /* istanbul ignore else: out of scope */
                if (err.meta && err.meta.statusCode === 404) {
                    return Promise.resolve(err.meta);
                } else {
                    // Not a 404, report it
                    this.app.report('ElasticService: Failed to delete index', err, {whichIndex, meta: err.meta});
                    return Promise.reject(err);
                }
            })
            .then(({ statusCode }) => {
                return statusCode === 200 || statusCode === 404;
            })
        ;
    }

    /**
     * Gets the current index doc type mappings
     * @param {{index:string}} [options] – Options
     * @returns {Promise<ApiResponse<any>>}
     */
    getMappings(options={}) {
        const { client, index } = this;
        const whichIndex = options.index || index;

        return client.indices
            .getMapping({
                ...options,
                index: whichIndex
            })
            .then(res => {
                return res;
            })
            .catch(/* istanbul ignore next: out of scope */err => {
                this.app.report('ElasticService: Failed to get index mappings', err, { whichIndex, meta: err.meta });
                return Promise.reject(err);
            })
        ;
    }

    /**
     * Gets the current index settings
     * @param {{index:string}} [options] – Options
     * @returns {Promise<ApiResponse<any>>}
     */
    getSettings(options={}) {
        const { client, index } = this;
        const whichIndex = options.index || index;

        return client.indices
            .getSettings({
                ...options,
                index: whichIndex
            })
            .then(res => {
                return res;
            })
            .catch(/* istanbul ignore next: out of scope */err => {
                this.app.report('ElasticService: Failed to get index settings', err, { whichIndex, meta: err.meta });
                return Promise.reject(err);
            })
        ;
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
     * Search for documents
     * @param {object} body - Query body
     * @param {object} [options] - Additional search options (like type:"myType" or scroll:'5m')
     * @returns {Promise<*>}
     */
    search(body={}, options={}) {
        const { client, index } = this;
        const whichIndex = options.index || index;

        const payload = {
            ...options,
            index: whichIndex,
            body
        };

        return client
            .search(payload)
            .then(res => {
                return res;
            })
            .catch(/* istanbul ignore next: out of scope */err => {
                this.app.report('ElasticService: Failed to search', err, { whichIndex, body, options, meta: err.meta });
                return Promise.reject(err);
            })
        ;
    }

    /**
     * Scrolls through an open search cursor
     * @param scroll_id
     * @param [options] - scroll options (scroll defaults to '5m')
     * @returns {Promise<*>}
     */
    scroll(scroll_id, options={}) {
        const { client } = this;
        const payload = {
            scroll: '5m',
            ...options,
            scroll_id,
        };

        return client
            .scroll(payload)
            .then(res => {
                return res;
            })
            .catch(/* istanbul ignore next: out of scope */err => {
                this.app.report('ElasticService: Failed to scroll', err, { scroll_id, options, meta: err.meta });
                return Promise.reject(err);
            })
        ;
    }

    /**
     * Cleans up an open scroll cursor resources
     * @param scroll_id
     * @param options
     * @returns {Promise<ApiResponse<any> | never>}
     */
    clearScroll(scroll_id, options={}) {
        const { client } = this;
        const payload = {
            ...options,
            scroll_id
        };

        //noinspection JSCheckFunctionSignatures - not our function
        return client
            .clearScroll(payload)
            .then(res => {
                return res;
            })
            .catch(/* istanbul ignore next: out of scope */err => {
                this.app.report('ElasticService: Failed to clear scroll', err, { scroll_id, options, meta: err.meta });
                return Promise.reject(err);
            })
        ;
    }

    /**
     * Sends a batch of operations to the index
     * @param {*} body – The raw bulk body
     * @param {object} [options] - Additional bulk options (like type:'myType', timeout defaults to '5m')
     * @returns {Promise<ApiResponse<any>>}
     */
    bulk(body, options={}) {
        const { client, index } = this;
        const whichIndex = options.index || index;
        const payload = {
            timeout: '5m',
            refresh: 'wait_for',
            ...options,
            index: whichIndex,
            body,
        };

        return client.bulk(payload)
            .then(res => {
                return res
            })
            .catch(/* istanbul ignore next: out of scope */err => {
                this.app.report('ElasticService: Failed to bulk index docs', err, { body, options, meta: err.meta });
                return Promise.reject(err);
            })
        ;
    }

    //noinspection ReservedWordAsName
    /**
     * Gets a document given its id.
     * @param {string} id - Document id
     * @param {object} [options] - Optional options, like `type`
     * @returns {Promise<*>}
     */
    get(id, options={}) {
        const { client, index } = this;
        const whichIndex = options.index || index;

        const payload = {
            type: '_all',
            ...options,
            index: whichIndex,
            id
        };

        return client.get(payload)
            .then(({ body }) => {
                return body;
            })
            .catch(err => {
                // Handle not found as success, but null doc
                /* istanbul ignore else: out of scope */
                if (err.meta && err.meta.statusCode === 404) {
                    return Promise.resolve(null);
                } else {
                    this.app.report('ElasticService: Failed to get doc', err, {id, options, meta: err.meta});
                    return Promise.reject(err);
                }
            })
        ;
    }

    /**
     * Adds or updates an index template
     * @param name
     * @param patterns
     * @param schema
     * @param options
     * @returns {Promise<ApiResponse<any> | never>}
     */
    putTemplate(name, patterns, schema, options={}) {
        const { client } = this;
        const payload = {
            ...options,
            name,
            body: this.app.copy({}, schema),

        };
        payload.body.index_patterns = patterns;

        return client.indices
            .putTemplate(payload)
            .then(res => {
                return res;
            })
            .catch(/* istanbul ignore next: out of scope */err => {
                this.app.report('ElasticService: Failed to put index template', err, { name, patterns, schema, meta: err.meta });
                return Promise.reject(err);
            })
        ;
    }

    /**
     * Removes an index template
     * @param name
     * @param options
     * @returns {Promise<ApiResponse<any>>}
     */
    deleteTemplate(name, options={}) {
        const { client } = this;
        return client.indices
            .deleteTemplate({
                ...options,
                name,
            })
            .catch(err => {
                /* istanbul ignore else: out of scope */
                if (err.meta && err.meta.statusCode === 404) {
                    return Promise.resolve(err.meta);
                } else {
                    this.app.report('ElasticService: Failed to remove index template', err, {name, meta: err.meta});
                    return Promise.reject(err);
                }
            })
            .then(res => {
                return res;
            })
        ;
    }

    /**
     * Updates the index template and creates the index based on the template if desired
     * @param {{ template_name:string, index_patterns:[string], template:*, index:{name:string}}} indexConfig
     * @param {boolean} doCreate – Whether to create the index if it does not exist
     * @param createSchema – Optional create index body, so you can override template settings (e.g. {settings:{number_of_shards:42}}). Defaults to `null`
     * @returns {Promise<boolean>}
     */
    ensureTemplatedIndex(indexConfig, doCreate, createSchema=null) {
        const { template_name, index_patterns, template, index } = indexConfig;
        const { name } = index;

        return this
            .putTemplate(template_name, index_patterns, template)
            .then(() => {
                if (doCreate) {
                    return this
                        .exists({ index: name })
                        .then(exists => {
                            if (!exists) {
                                return this.create({ index: name, schema: createSchema }) // from template
                            } else {
                                return Promise.resolve(exists);
                            }
                        })
                    ;
                } else {
                    return Promise.resolve(true);
                }
            })
        ;
    }
}

module.exports = ElasticService;