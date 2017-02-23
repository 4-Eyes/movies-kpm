let request = null,
    apiUrl = "http://www.imdb.com/title/",
    xpath = require('xpath'),
    dom = require('xmldom').DOMParser,
    callbackDictionary = {};

const processIMDbPage = function (error, response) {
    if (!error && response.statusCode === 200) {
        var doc = new dom().parseFromString(response.body);
        var nodes = xpath.select("//a", doc); // Probably better idea to use regex
    }
    callbackDictionary[response.request.uri.path.match(/(tt[0-9]+)/)[0]](error, response);
}

module.exports = function (requests) {
    request = requests;
    return {
        getMovieDetails: function (id, callback) {
            callbackDictionary[id] = callback;
            const options = {
                url: apiUrl + id
            }
            request(options, processIMDbPage);
        }
    }
}