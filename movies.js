var request = require('request');
var omdb = require('omdb');
var movieDBFunction = require('moviedb');
var movieDB = null;

exports.match = function(text, commandPrefix) {
    return text.startsWith(commandPrefix + "movies");
}

var error = function(api, err) {
    api.sendMessage("There was an error: " + err);
}

exports.run = function (api, event) {
    var words = event.body.split(" ");
    words.splice(0, 1);
    var secondaryCommand = words.splice(0, 1)[0];
    switch (secondaryCommand) {
        case "-apiKey":
            exports.config.APIKey = words[0];
            api.sendMessage("Successfullly added the API Key: " + words[0]);
            return;
        default:
            words.splice(0, 0, secondaryCommand);
    }
    if (movieDB == null) {
        if (exports.config.APIKey == null) {
            api.sendMessage("You need a TMDB API key for this module to work.");
            return;
        }
        movieDB = movieDBFunction(exports.config.APIKey);
    }
    var title = words.join(" ");
    movieDB.searchMovie({ query: title }, function (err, res) {
        if (err) {
            error(api, err);
            return;
        }
        if (res.results.length > 0) {
            movieDB.movieInfo({ id: res.results[0].id, append_to_response: "external_ids" },
                function(err, res) {
                    if (err) {
                        error(api, err);
                        return;
                    }
                    omdb.get({ imdb: res.imdb_id },
                        { tomatoes: true },
                        function(err, movie) {
                            if (err) {
                                error(api, err);
                                return;
                            }
                    var message = "Title: " + movie.title + "\n";
                    message += "IMDb Rating: " + movie.imdb.rating + "\n";
                    message += "RottenTomatoes: " + (movie.tomato == null ?  "N/A" : movie.tomato.meter + "%")+ "\n";
                    message += "Metacritic: " + (movie.metacritic == null ? "N/A" : movie.metacritic) + "\n";
                    api.sendMessage(message);

                        });
                });
        } else {
            error(api, "No results for the movie title given");
        }
    });
}