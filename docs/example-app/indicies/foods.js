"use strict";

module.exports = {
    mappings: {
        _doc: {
            properties: {
                name:                   { type: 'text',  analyzer: 'html_snowball',
                    fields: {
                        raw:            { type: 'keyword' },
                        lowered:        { type: 'text', analyzer: 'lowercase_only' }
                    }
                },
                type:                   { type: 'keyword' },
                description:            { type: 'text',  analyzer: 'html_snowball' },
                color:                  { type: 'keyword', },
            }
        },
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