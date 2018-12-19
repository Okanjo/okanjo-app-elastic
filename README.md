# Okanjo Elasticsearch Service

[![Build Status](https://travis-ci.org/Okanjo/okanjo-app-elastic.svg?branch=master)](https://travis-ci.org/Okanjo/okanjo-app-elastic) [![Coverage Status](https://coveralls.io/repos/github/Okanjo/okanjo-app-elastic/badge.svg?branch=master)](https://coveralls.io/github/Okanjo/okanjo-app-elastic?branch=master)

Service for interfacing with Elasticsearch for the Okanjo App ecosystem.

This package wraps interfacing with Elasticsearch, so:

* Index management is nearly automatic
* Common elastic operations are simplified
* Built in error reporting for common operations


## Installing

Add to your project like so: 

```sh
npm install okanjo-app-elastic
```

Note: requires the [`okanjo-app`](https://github.com/okanjo/okanjo-app) module.

## Example Usage

This module works by specifying the index name, schema, and types of documents stored within the index.

Here's a single file example:
```js
const OkanjoApp = require('okanjo-app');
const ElasticService = require('okanjo-app-elastic');

const config = {
    elasticsearch: {
        host: '192.168.99.100:9200', // e.g. user:pass@hostname:port of elastic instance(s)
        requestTimeout: 120000, // how long to wait (in milliseconds) until a response is assumed to be abandoned (e.g. bulk loading)
        log: 'warning', // logging level, one of: error, warning, info, debug, trace

        // the index the service should manage
        index: {
            name: 'foods',
            schema: { // recommend splitting this out to its own file and then require(schema.js)
                mappings: {
                    fruit: {
                        properties: {
                            name:                   { type: 'text', include_in_all: true, analyzer: 'html_snowball',
                                fields: {
                                    raw:            { type: 'keyword' },
                                    lowered:        { type: 'text', analyzer: 'lowercase_only' }
                                }
                            },
                            description:            { type: 'text', include_in_all: true, analyzer: 'html_snowball' },
                            color:                  { type: 'keyword', include_in_all: false },
                            fruit_only_attribute:   { enabled: false }
                        }
                    },
                    veggie: {
                        properties: {
                            name:                   { type: 'text', include_in_all: true, analyzer: 'html_snowball',
                                fields: {
                                    raw:            { type: 'keyword' },
                                    lowered:        { type: 'text', analyzer: 'lowercase_only' }
                                }
                            },                            
                            description:            { type: 'text', include_in_all: true, analyzer: 'html_snowball'},
                            color:                  { type: 'keyword', include_in_all: false },
                            veggie_only_attribute:  { enabled: false }
                        }
                    }
                },
                settings: {
                    analysis: {
                        analyzer: {
                            // custom analyzer that just lowercases as a keyword
                            lowercase_only: {
                                type: "custom",
                                char_filter: [],
                                tokenizer: "keyword",
                                filter: ["lowercase"]
                            },
            
                            // custom analyzer that strips html, stopwords, and snowballs
                            html_snowball: {
                                type: "custom",
                                char_filter: ["html_strip"],
                                tokenizer: "standard",
                                filter: ["lowercase", "stop", "snowball"]
                            }
                        }
                    }
                }
            },
            types: { // enumeration for the types you defined in the schema, to make it easy for query purposes later
                fruit: 'fruit',
                veggie: 'veggie'
            }
        }
    }
};

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
```

A more ideal setup for an application can be found in [docs/example-app](https://github.com/okanjo/okanjo-app-elastic/tree/master/docs/example-app).
It does exactly the same thing as depicted above, but is managed in a much more maintainable way.

# ElasticService

Elasticsearch management class. Must be instantiated to be used.

## Properties
* `elastic.app` – (read-only) The OkanjoApp instance provided when constructed
* `elastic.config` – (read-only) The configuration provided when constructed
* `elastic.index` – (read-only) The string name of the index this instance is bound to
* `elastic.schema` – (read-only) The index settings object for the index this instance is bound to
* `elastic.types` – (read-only) The enumeration of types of documents stored in the index 
* `elastic.client` – (read-only) The original elasticsearch client, usable for non-wrapped operations 

## Methods

### `new ElasticSearch(app, [config])`
Creates a new elastic service instance.
* `app` – The OkanjoApp instance to bind to
* `config` – The elasticsearch service configuration object.

### `elastic.exists(callback)`
Checks whether the index exists or not.  
* `callback(err, exists)` – Function to fire when completed
  * `err` – Error, if present
  * `exists` – Boolean, `true` if index currently exists or `false` if not.
 
### `elastic.ping(callback)`
Pings the elasticsearch server to see if it is available.  
* `callback(err, exists)` – Function to fire when completed
  * `err` – Error, if present
  * `exists` – Boolean, `true` if service is available or `false` if not.
 
### `elastic.create([options], callback)`
Creates the elasticsearch index as configured by the name and schema.
* `options` – Optional, create index command options
  * `index` – The name of the index to create, defaults to `elastic.index`.
  * `schema` – Optional, The index mappings and settings object, `null` to not set a body at all (e.g. use existing template), or leave unset to default to `elastic.schema`.
* `callback(err, success, res)` – Function to fire when completed
  * `err` – Error, if present
  * `success` – Whether the statusCode of the response was `200`
  * `res` – The reponse given from elasticsearch
  
### `elastic.delete(callback)`
Deletes the elasticsearch index as configured.
* `callback(err, success, res)` – Function to fire when completed
  * `err` – Error, if present
  * `success` – Whether the statusCode of the response was `200` (or `400` if the index does not exist)
  * `res` – The reponse given from elasticsearch

### `elastic.ensure(callback)`
Creates the index if it does not exist, and if it does, compares the live mappings and settings to what's configured, 
adding new mappings and warning of changes. Useful for typical app startup processes.
* `callback(err, consistent, exists, settingsConsistent, mappingsConsistent)` – Function to fire when completed
  * `err` – Error, if present
  * `consistent` – Whether the index is fully consistent with the local schema.
  * `exists` – Whether the index existed previously to running `ensure()`
  * `settingsConsistent` – Whether the settings were consistent with the local schema.
  * `mappingsConsistent` – Whether the mappings were consistent with the local schema.

Note: You cannot change mappings or settings in elasticsearch indices, but you may add to them.

This method will ensure that your remote mappings and settings match what is stored locally. 
* Any new mappings will be added.
* Any conflicting mappings will be reported.
 
If there are conflicts, you will need to take charge of reindexing. There are a number of ways to do this.
* Delete, recreate, and reindex the data
* Create a new index with a different name, reindex the data there, and use aliases to atomically swap the pointer of the index to the new one

### `elastic.search(body, [options,] callback)`
Searches the index for documents.
* `body` – Search request object, e.g. `{ query: { match_all: {} } }`
* `options` – Elastic request options, e.g. `{ limit: 5 }`
* `callback(err, res, status)` – Function to fire when completed
  * `err` – Error, if present
  * `res` – The response given from elasticsearch
  * `status` – The statusCode of the response

### `elastic.get(id, [options,] callback)`
Sends a batch of bulk operations to the index.
* `id` – The id of the document to fetch
* `options` – Elastic request options
* `callback(err, res, status)` – Function to fire when completed
  * `err` – Error, if present
  * `res` – The response given from elasticsearch
  * `status` – The statusCode of the response  

### `elastic.scroll(scrollId, [options,] callback)`
Scrolls through an open search cursor. Renews the scroll cursor timeout to 5 minutes.
* `scrollId` – The active scroll id
* `options` – Elastic request options
* `callback(err, res, status)` – Function to fire when completed
  * `err` – Error, if present
  * `res` – The response given from elasticsearch
  * `status` – The statusCode of the response
  
### `elastic.clearScroll(scrollId, callback)`
Cleans up an open scroll cursor. Use this when done scrolling.
* `scrollId` – The active scroll id
* `callback(err, res, status)` – Function to fire when completed
  * `err` – Error, if present
  * `res` – The response given from elasticsearch
  * `status` – The statusCode of the response

### `elastic.bulk(body, [options,] callback)`
Sends a batch of bulk operations to the index.
* `body` – The bulk body payload, array of operations
* `options` – Elastic request options
* `callback(err, res, status)` – Function to fire when completed
  * `err` – Error, if present
  * `res` – The response given from elasticsearch
  * `status` – The statusCode of the response

### `elastic.getMappings(callback)`
Gets the index's current mappings.
* `callback(err, res, status)` – Function to fire when completed
  * `err` – Error, if present
  * `res` – The response given from elasticsearch
  * `status` – The statusCode of the response
  
### `elastic.getSettings(callback)`
Gets the index's current settings.
* `callback(err, res, status)` – Function to fire when completed
  * `err` – Error, if present
  * `res` – The response given from elasticsearch
  * `status` – The statusCode of the response

### `elastic.putTemplate(name, schema, index_patterns, [options], callback)`
Creates or updates an index template.
* `name` – Template name
* `index_patterns` – Array of index pattern strings
* `schema` – Template body, e.g. `{ mappings: {}, settings: {} }`
* `options` – Optional, Elasticsearch route putTemplate options
* `callback(err, res, status)` – Function to fire when completed
  * `err` – Error, if present
  * `res` – The response given from elasticsearch
  * `status` – The statusCode of the response

### `elastic.deleteTemplate(name, callback)`
* `name` – Template name to delete
* `callback(err, res, status)` – Function to fire when completed
  * `err` – Error, if present
  * `res` – The response given from elasticsearch
  * `status` – The statusCode of the response
 
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
docker pull docker pull docker.elastic.co/elasticsearch/elasticsearch:5.5.3
sudo sysctl -w vm.max_map_count=262144
# docker-machine ssh default "sudo sysctl -w vm.max_map_count=262144"
docker run -d -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:5.5.3
```

If you use docker via virtualbox (e.g. mac, windows), then you'll want that docker-machine line above instead.

To run unit tests and code coverage:
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
