"use strict";

module.exports = {
    settings: {
        "number_of_shards": 2,
        analysis: {
            analyzer: {

                lowercase_only: {
                    type: "custom",
                    char_filter: [],
                    tokenizer: "keyword",
                    filter: ["lowercase"]
                },

                html_snowball: {
                    type: "custom",
                    char_filter: ["html_strip"],
                    tokenizer: "standard",
                    filter: ["lowercase", "stop", "snowball"]
                }
            }
        }
    },
    mappings: {
        my_thing: {
            properties: {

                atom: {
                    type: "long",
                    //include_in_all: false
                },

                atom2: {
                    type: "long",
                    //include_in_all: false
                },

                my_bool: {
                    type: "boolean",
                    //include_in_all: false
                },

                raw_thing: {
                    enabled: false
                },

                some_url: {
                    type: "keyword",
                    //include_in_all: false
                },

                category: {
                    type: "text",
                    analyzer: "snowball",
                    fields: {
                        raw: {
                            type: "keyword"
                        },
                        lowered: {
                            type: "text",
                            analyzer: "lowercase_only"
                        }
                    }
                },

                condition: {
                    type: "keyword",
                    //include_in_all: false
                },

                created: {
                    type: "date",
                    format: "dateOptionalTime",
                    //include_in_all: false
                },

                name: {
                    type: "text",
                    analyzer: "html_snowball",
                    //include_in_all: true
                }

            }
        }
    }
};

