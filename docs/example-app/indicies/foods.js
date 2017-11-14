"use strict";

module.exports = {
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
};