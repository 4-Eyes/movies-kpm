var request = require('request');
var omdb = require('omdb');
var movieDBFunction = require('moviedb');
var movieDB = null;

var error = function(api, event, err) {
    api.sendMessage("There was an error: " + err, event.thread_id);
}

exports.run = function (api, event) {
    var words = event.body.split(" ");
    words.splice(0, 1);
    if (words.length === 0) {
        api.sendMessage("Well you didn't tell me to do anything so I shant.", event.thread_id);
        return;
    }
    var secondaryCommand = words.splice(0, 1)[0];
    switch (secondaryCommand) {
        case "-apiKey":
            exports.config.APIKey = words[0];
            api.sendMessage("Successfullly added the API Key: " + words[0], event.thread_id);
            return;
        default:
            words.splice(0, 0, secondaryCommand);
    }
    if (movieDB == null) {
        if (exports.config.APIKey == null) {
            api.sendMessage("You need a TMDB API key for this module to work.", event.thread_id);
            return;
        }
        movieDB = movieDBFunction(exports.config.APIKey);
    }
    var title = words.join(" ");
    movieDB.searchMovie({ query: title }, function (err, res) {
        if (err) {
            error(api, event, err);
            return;
        }
        if (res.results.length > 0) {
            res.results.sort(function(a, b) {
                return b.popularity - a.popularity;
            });
            movieDB.movieInfo({ id: res.results[0].id, append_to_response: "external_ids" },
                function(err, res) {
                    if (err) {
                        error(api, event, err);
                        return;
                    }
                    omdb.get({ imdb: res.imdb_id },
                        { tomatoes: true },
                        function(err, movie) {
                            if (err) {
                                error(api, event, err);
                                return;
                            }

                            api.sendImage('url', movie.poster, '', event.thread_id);

                            let imdbRating = movie.imdb ?  movie.imdb.rating : 'N/A',
                                tomatoesRating = movie.tomato ? movie.tomato.meter + '%' : 'N/A',
                                metacriticRating = movie.metacritic ? movie.metacritic : 'N/A';

                            setTimeout(() => { // try let the image render first
                                let message = `${movie.title}\n------------------------------------\n${movie.plot}\n\n`;
                                message += `IMDB Rating: \t${imdbRating}\tRottenTomatoes: \t${tomatoesRating}\n`;
                                message += `Metacritic:  \t${metacriticRating}\tRuntime:        \t${movie.runtime} mins\n`;

                                api.sendMessage(message, event.thread_id);
                            }, 200);
                        });
                });
        } else {
            error(api, event, "No results for the movie title given");
        }
    });
}
