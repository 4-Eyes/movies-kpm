let request = require('request'),
    omdb = require('omdb'),
    movieDBFunction = require('moviedb'),
    flicks = require("./src/flicks.js")(request),
    movieDB = null,
    searchCache = {},
    sortBy = require("./src/sorting.js")();

let options = [
        {
            long: '--key',
            short: '-k',
            description: 'Sets the TMDB API key',
            expects: ['<string>KEY'],
            run : (values) => {
                exports.config.APIKey = values[0];
                values[1].sendMessage(`Successfully added the API Key: ${values[0]}`, values[2].thread_id);
            }
        },
        {
            long: '--search',
            short: '-s',
            description: 'Returns search results for a title',
            config: true
        },
        {
            long: '--searchResponse',
            short: '-sr',
            description: 'Returns details on the movie specified by the results number based on numbering of the last search on the thread the command comes from',
            expects: ['<int>RESULTNO'],
            config: true
        },
        {
            long: '--recommend',
            short: '-r',
            description: 'Recommends you a movie',
            config: true
        },
        {
            long: '--year',
            short: '-y',
            description: 'Filters movies by the specified year',
            expects:['<int>YEAR'],
            config: true
        },
        {
            long: '--coming',
            short: '-c',
            description: 'Gives results of movies coming soon. Currently this will only work for NZ',
            config: true
        },
		{
			long: '--help',
			short: '-h',
			description: 'Shows help for this module.',
			run: (values) => {
				let api = values[0],
					event = values[1],
					result = 'USAGE\n\t' + api.commandPrefix + 'movies ' + '<options...> <searchString>'.cyan + '\nOPTIONS';
                for (let i = 0; i < options.length; i++) {
                    let infoStr = '\t' + options[i].short + ', ' + options[i].long;
                    if (options[i].expects) {
                        infoStr += ' ';
                        for (let j = 0; j < options[i].expects.length; j++) {
                            infoStr += '{' + options[i].expects[j].yellow + '} ';
                        }
                    }
					result += '\n' + infoStr + '\n\t\t' + options[i].description;
                }
				api.sendMessage(result, event.thread_id);
				return true;
			}
		}
    ];

const error = (api, event, err) => {
    api.sendMessage(`There was an error: ${err}`, event.thread_id);
};

const performChecks = function (api, event, sessConfig) {
    if ((!event.arguments || event.arguments.length === 0) && Object.keys(sessConfig).length === 0 && sessConfig.constructor === Object) {
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

const formatSearch = function(results) {
    let message = "";
    for (let i = 0; i < results.length; i++) {
        let result = results[i];
        message += (i + 1) + ") " + result.title + " (" + result.release_date.slice(0, 4) + ")\n";
    }
    return message;
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
            if (!event.arguments[i + j]) {
                error(api, event, "Invalid number of arguments given");
            }
            vals.push(event.arguments[i + j]);
        }

        vals.push(api);
        vals.push(event);
        if (pargs[0].run) {
            let res = pargs[0].run(vals);
			if (res) {
				return;
			}
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
    if (!performChecks(api, event, sessionConfig)) return;


    if (sessionConfig['-r'] || sessionConfig['c']) {
        error(api, event, "This hasn't been implemented yet. Blame the lazy devs.");
        return;
    }
    if (sessionConfig['-sr']) {
        let index = parseInt(sessionConfig['-sr']) - 1;
        if (!index || index === NaN || index >= searchCache[event.thread_id].length) {
            error(api, event, "Well that's not a number or it's an invalid number. Silly person.")
            return;
        }
        movieDB.movieInfo({id: searchCache[event.thread_id][index].id, append_to_response: "external_ids"},
            (er, rs) => {
                if (er) {
                    error(api, event, er);
                }
                sendMovieData(api, event, rs.imdb_id);
            });
        return;
    }
    movieDB.searchMovie({ query: title }, (err, res) => {
        if (err) {
            error(api, event, err);
            return;
        }
        if (res.results.length > 0) {
            if (sessionConfig['-y']) {
                res.results.sort(sortBy(
                    {
                        name:'release_date',
                        primer: function(item) {
                            return Math.abs(parseInt(item.slice(0, 4)) - parseInt(sessionConfig['-y'][0]));
                        }
                    },
                    {
                        name:'popularity',
                        reverse:true
                    })
                );
            } else {
                res.results.sort((a, b) => b.popularity - a.popularity);
            }
            if (sessionConfig['-s']) {
                searchCache[event.thread_id] = res.results;
                const message = formatSearch(res.results);
                api.sendMessage(message, event.thread_id);
                return;
            }
            movieDB.movieInfo({ id: res.results[0].id, append_to_response: "external_ids" },
                (err1, res1) => {
                    if (err1) {
                        error(api, event, err1);
                        return;
                    }
                    sendMovieData(api, event, res1.imdb_id);
                });
        } else {
            error(api, event, "No results for the movie title given");
        }
    });
};
