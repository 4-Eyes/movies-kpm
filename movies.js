let request = require('request'),
	omdb = require('omdb'),
	movieDBFunction = require('moviedb'),
	movieDB = null;

const error = (api, event, err) => {
    api.sendMessage(`There was an error: ${err}`, event.thread_id);
};

exports.run = (api, event) => {
    const words = event.body.split(" ");
    words.splice(0, 1);
    if (words.length === 0) {
        api.sendMessage("Well you didn't tell me to do anything so I shant.", event.thread_id);
        return;
    }
    const secondaryCommand = words.splice(0, 1)[0];
    switch (secondaryCommand) {
        case "-apiKey":
            exports.config.APIKey = words[0];
            api.sendMessage(`Successfullly added the API Key: ${words[0]}`, event.thread_id);
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
    const title = words.join(" ");
    movieDB.searchMovie({ query: title }, (err, res) => {
        if (err) {
            error(api, event, err);
            return;
        }
        if (res.results.length > 0) {
            res.results.sort((a, b) => b.popularity - a.popularity);
            movieDB.movieInfo({ id: res.results[0].id, append_to_response: "external_ids" },
                (err, res) => {
                    if (err) {
                        error(api, event, err);
                        return;
                    }
                    omdb.get({ imdb: res.imdb_id },
                        { tomatoes: true },
                        (err, movie) => {
                            if (err) {
                                error(api, event, err);
                                return;
                            }

                            api.sendImage('url', movie.poster, '', event.thread_id);

                            let imdbRating = movie.imdb.rating;
                            let tomatoesRating = movie.tomato ? `${movie.tomato.meter}%` : 'N/A';
                            let metacriticRating = movie.metacritic ? movie.metacritic : 'N/A';

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
};
