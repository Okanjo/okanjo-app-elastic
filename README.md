# Okanjo Elasticsearch Service

[![Node.js CI](https://github.com/Okanjo/okanjo-app-elastic/actions/workflows/node.js.yml/badge.svg)](https://github.com/Okanjo/okanjo-app-elastic/actions/workflows/node.js.yml) [![Coverage Status](https://coveralls.io/repos/github/Okanjo/okanjo-app-elastic/badge.svg?branch=master)](https://coveralls.io/github/Okanjo/okanjo-app-elastic?branch=master)

Service for interfacing with Elasticsearch for the Okanjo App ecosystem.

This package wraps interfacing with Elasticsearch, so:

* Common elastic operations are simplified
* Built in error reporting for common operations


## Installing

Add to your project like so: 

```sh
npm install okanjo-app-elastic
```

> Peer dependency: Requires [`@elastic/elasticsearch`](https://github.com/elastic/elasticsearch-js) module. Version >= 6.

> Requires the [`okanjo-app`](https://github.com/okanjo/okanjo-app) module.

## Example Usage

An example application can be found in [docs/example-app](https://github.com/okanjo/okanjo-app-elastic/tree/master/docs/example-app).
It demonstrates creating an index, loading documents, and searching.

# ElasticService

Elasticsearch management class. Must be instantiated to be used.

## Properties
* `elastic.app` – (read-only) The OkanjoApp instance provided when constructed
* `elastic.config` – (read-only) The configuration provided when constructed
* `elastic.index` – (read-only) The string name of the index this instance is bound to
* `elastic.schema` – (read-only) The index settings object for the index this instance is bound to
* `elastic.types` – (read-only) The enumeration of types of documents stored in the index 
* `elastic.client` – (read-only) The elasticsearch client, usable for non-wrapped operations 

## Methods

### `new ElasticSearch(app, clientConfig, indexConfig)`
Creates a new elastic service instance.
* `app` – The OkanjoApp instance to bind to
* `clientConfig` – The [elasticsearch client configuration](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/client-configuration.html) object
* `indexConfig` – The index configuration object.
  * `indexConfig.name` – String name of the index
  * `indexConfig.schema` – Index configuration. Should be an object that contains the mappings and settings of the index. This value is used as the body of the create index command.
  * `indexConfig.types` – (Legacy) Object map of key-value pairs, defining the types stored in the index. 

### `elastic.exists([options])`
Checks whether the index exists or not.
* `options.index` – Specifiy which index to check existence of
* `options.*` – Passed to the `client.indices.exists` request.  
Returns `Promise<boolean>`, where the result is `true` if the index exists or `false` if not. 
 
### `elastic.ping()`
Pings the elasticsearch server to see if it is available.  
Returns `Promise<boolean>`, where the result is `true` if the available or `false` if not. 
 
### `elastic.create([options])`
Creates the elasticsearch index as configured by the name and schema.
* `options.index` – The name of the index to create, defaults to the service `index` property.
* `options.schema` – The index mappings and settings object or `null` to not set a body at all (e.g. use existing template), or leave unset to default to the service `schema` property.
* `options.*` – Additional create index request options
Returns `Promise<boolean>`, where the result is `true` if the index was created.
 
### `elastic.delete([options])`
Deletes the elasticsearch index as configured.
* `options.index` – The name of the index to create, defaults to the service `index` property.\
* `options.*` – Additional delete index request options
Returns `Promise<boolean>`, where the result is `true` if the index was deleted or does not exist.

### `elastic.search(body, [options])`
Searches the index for documents.
* `body` – Search request object, e.g. `{ query: { match_all: {} } }`
* `options.index` – The name of the index to search, defaults to the service `index` property.
* `options.*` – Elastic request options, e.g. `{ limit: 5 }`

### `elastic.get(id, [options])`
Retrieves a doc from the index.
* `id` – The id of the document to fetch
* `options.index` – The name of the index the doc lives in, defaults to the service `index` property.
* `options.*` – Additional get request options

### `elastic.scroll(scrollId, [options])`
Scrolls through an open search cursor. Renews the scroll cursor timeout to 5 minutes.
* `scrollId` – The active scroll id
* `options.scroll` – Time to let the cursor live. Defaults to `5m`;
* `options.*` – Additional scroll request options 
  
### `elastic.clearScroll(scrollId, [options])`
Cleans up an open scroll cursor. Use this when done scrolling.
* `scrollId` – The active scroll id
* `options.*` – Additional clearScroll request options 

### `elastic.bulk(body, [options,] callback)`
Sends a batch of bulk operations to the index.
* `body` – The bulk body payload, array of operations
* `options.index` – The name of the index to operate on, defaults to the service `index` property.
* `options.timeout` – How long to let the bulk operation run. Defaults to `5m`.
* `options.refresh` –  `true`, `false`, `wait_for` - If `true` then refresh the effected shards to make this operation visible to search, if `wait_for` then wait for a refresh to make this operation visible to search, if `false` then do nothing with refreshes. Defaults to `wait_for`.
* `options.*` – Additional bulk request options

### `elastic.getMappings([options])`
Gets the index's current mappings.
* `options.index` – The name of the index to operate on, defaults to the service `index` property.
* `options.*` – Additional getMappings request options
  
### `elastic.getSettings([options])`
Gets the index's current settings.
* `options.index` – The name of the index to operate on, defaults to the service `index` property.
* `options.*` – Additional getMappings request options

### `elastic.putTemplate(name, index_patterns, schema, [options])`
Creates or updates an index template.
* `name` – Template name
* `index_patterns` – Array of index pattern strings
* `schema` – Template body, e.g. `{ mappings: {}, settings: {} }`
* `options.*` – Additional putTemplate request options

### `elastic.deleteTemplate(name, callback)`
* `name` – Template name to delete
* `options.*` – Additional deleteTemplate request options

### `elastic.ensureTemplatedIndex(indexConfig, doCreate, [createSchema])`
* `indexConfig` – Typical index configuration object
  * `indexConfig.template_name` – Name of the template
  * `indexConfig.index_patterns` - Array of the index patterns the template applies to
  * `indexConfig.template` – The index mappings and settings template
  * `indexConfig.index.name` – The name of the index to create
* `doCreate` - When truthy, the index will be created if not already present
* `createSchema` – Optional. Override the template mappings and settings, if desired. Defaults to `null` to inherit the template mappings and settings. Use this for overriding stuff like shard counts, e.g. `{ settings: { number_of_shards: 10 } }`

 
### Not Implemented?
Is your elastic client function missing? No problem. 

Use `elastic.client` to talk to elasticsearch directly. 
Errors will not be automatically reported, so you'll need to do that yourself.
 
## Events

This class fires no events.


## Extending and Contributing 

Our goal is quality-driven development. Please ensure that 100% of the code is covered with testing.

Before contributing pull requests, please ensure that changes are covered with unit tests, and that all are passing. 

### Testing

Before you can run the tests, you'll need a working elasticsearch server. We suggest using docker.

For example:

```bash
docker pull docker.elastic.co/elasticsearch/elasticsearch:6.8.22
sudo sysctl -w vm.max_map_count=262144
# docker-machine ssh default "sudo sysctl -w vm.max_map_count=262144"
docker run -d -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:6.8.22
```

If you use docker via virtualbox (e.g. mac, windows), then you'll want that docker-machine line above instead.

To run unit tests and code coverage:

```sh
npm run report
```

Or with custom elasticseraach server

```sh
ES_HOST=elastic:changeme@192.168.99.100:9200 npm run report
```

Update the `ES_HOST` environment var to match your docker host (e.g. 127.0.0.1, user, pass, etc)

This will perform:
* Unit tests
* Code coverage report
* Code linting

Sometimes, that's overkill to quickly test a quick change. To run just the unit tests:
 
```sh
npm test
```

or if you have mocha installed globally, you may run `mocha test` instead.
