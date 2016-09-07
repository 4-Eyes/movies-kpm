let request = require('request'),
    omdb = require('omdb'),
    movieDBFunction = require('moviedb'),
    flicks = require("./src/flicks.js")(request),
    movieDB = null;

let options = [
        {
            long: '--key',
            short: '-k',
            description: 'Sets the TMDB API key',
            expects: ['KEY'],
            run : (values) => {
                exports.config.APIKey = values[0];
                values[1].sendMessage(`Successfully added the API Key: ${values[0]}`, values[2].thread_id);
            }
        },
        {
            long: '--search',
            short: '-s',
            description: 'Returns search results for a title',
            expects: ['QUERY'],
            config: true
        },
        {
            long: '--recommend',
            short: '-r',
            description: 'Recommends you a movie',
            config: true
        }
    ];

const error = (api, event, err) => {
    api.sendMessage(`There was an error: ${err}`, event.thread_id);
};

const performChecks = function (api, event) {
    if (!event.arguments || event.arguments.length === 0) {
        api.sendMessage("Well you didn't tell me to do anything so I shant.", event.thread_id);
        return false;
    }
    if (movieDB == null) {
        if (exports.config.APIKey == null) {
            api.sendMessage("You need a TMDB API key for this module to work.", event.thread_id);
            return false;
        }
        movieDB = movieDBFunction(exports.config.APIKey);
    }
    return true;
}

const sendMovieData = (api, event, imdbID) =>
{
    omdb.get({ imdb: imdbID },
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
}

exports.run = (api, event) => {
    flicks.getNowPlaying(function(error, res, body) {
        console.log(body);
    });
    return;
    let sessionConfig = {};
    for (let i = 1; i < event.arguments.length; i++) {
        let arg = event.arguments[i],
            pargs = options.filter((value) => { return value.short === arg || value.long === arg; });
        if (pargs.length === 0) {
            continue;
        }
        else if (pargs.length > 1) {
            return api.sendMessage('Arguments cannot overlap... what have you been doing? I don\'t understand.',
                event.thread_id);
        }

        let vals = [],
            count = (pargs[0].expects || {}).length || 0;
        for (let j = 1; j <= count; j++) {
            vals.push(event.arguments[i + j]);
        }

        vals.push(api);
        vals.push(event);
        if (pargs[0].run) {
            pargs[0].run(vals);
        }
        else if (pargs[0].config) {
            if (!pargs[0].expects) {
                sessionConfig[pargs[0].short] = true;
            } else {
                sessionConfig[pargs[0].short] = vals.slice(0, -2);
            }
        }
        let diff = 1 + count;
        event.arguments.splice(i, diff);
        i -= diff;
    }
    const words = event.arguments;
    words.splice(0, 1);
    const title = words.join(" ");
    if (!performChecks(api, event)) return;



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
                    sendMovieData(api, event, res.imdb_id);
                });
        } else {
            error(api, event, "No results for the movie title given");
        }
    });
};
