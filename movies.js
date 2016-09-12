let request = require('request'),
    omdb = require('omdb'),
    movieDBFunction = require('moviedb'),
    async = require('async'),
    flicks = require("./src/flicks.js")(request),
    movieDB = null,
    searchCache = {},
    comingSoonCache = {},
    sortBy = require("./src/sorting.js")();

let options = [
        {
            long: '--key',
            short: '-k',
            description: 'Sets the TMDB API key.',
            expects: ['KEY'],
            run : (values) => {
                exports.config.APIKey = values[0];
                values[1].sendMessage(`Successfully added the API Key: ${values[0]}`, values[2].thread_id);
            }
        },
        {
            long: '--search',
            short: '-s',
            description: 'Returns search results for a title.',
            config: true
        },
        {
            long: '--searchResponse',
            short: '-sr',
            description: 'Returns details on the movie specified by the results number based on\n\t\tnumbering of the last search on the thread the command comes from.',
            expects: ['RESULTNO'],
            config: true
        },
        {
            long: '--recommend',
            short: '-r',
            description: 'Recommends you a movie.',
            config: true
        },
        {
            long: '--year',
            short: '-y',
            description: 'Filters movies by the specified year.',
            expects:['YEAR'],
            config: true
        },
        {
            long: '--coming',
            short: '-c',
            description: 'Gives results of movies coming soon. Currently this will only work for NZ.',
            config: true
        },
        {
            long: '--cResult',
            short: '-cr',
            description: 'Gives more detail on a previous coming soon results set',
            expects:['RESULTNO'],
            config: true
        },
		{
			long: '--help',
			short: '-h',
			description: 'Shows help for this module.',
			run: (values) => {
				let api = values[0],
					event = values[1],
					result = 'USAGE\n\t' + api.commandPrefix + 'movies ' + '<options...> <searchString>' + '\nOPTIONS';
                for (let i = 0; i < options.length; i++) {
                    let infoStr = '\t' + options[i].short + ', ' + options[i].long;
                    if (options[i].expects) {
                        infoStr += ' ';
                        for (let j = 0; j < options[i].expects.length; j++) {
                            infoStr += '{' + options[i].expects[j] + '} ';
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

function isEmptyOrSpaces(str) {
    return str === null || str.match(/^ *$/) !== null;
}

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

const getMovieData = (imdbID, callback) => {
    omdb.get({ imdb: imdbID },
        { tomatoes: true }, callback);
}

const sendComingSoon = function (api, event, results) {
    let r = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
    let message = "";
    let requests = [];
    for (let i = 0; i < results.length; i++) {
        let result = results[i];
        let release = new Date(result.releaseDate);
        if (isNaN(release.getTime())) {
            let match = result.releaseDate.match(r);
            release = new Date(match[1] +
                "-" +
                (match[2] === '99' ? '12' : match[2]) +
                "-" +
                (match[3] === '99' ? '31' : match[3])); // not a great way of doing it as if the month is valid and has less than 31 days it will go to the next month
        }
        if ((release - new Date()) / 86400000 <= 7 && !result.title.contains('3D')) { // 86400000 is the number of milliseconds in a day. Also ignore #D titles as they double up
            requests.push(function (callback) {
                movieDB.searchMovie({ query: result.title.replace(/ \([0-9]{4}\)$/, ""), year: new Date().getFullYear().toString()}, function(err, res) {
                    if (err) {
                        callback(new Error("Failed to search for movie " + result.title));
                        return;
                    }
                    res.results.sort((a, b) => b.popularity - a.popularity);
                    if (res.total_results === 0) {
                        callback(null, null);
                        return;
                    }
                    movieDB.movieInfo({ id: res.results[0].id, append_to_response: "external_ids" }, (er, rs) => {
                        if (er) {
                            callback(new Error("Failed to get TMDb data for the title"));
                            return;
                        }
                        if (!rs.imdb_id) {
                            callback(null, null);
                            return;
                        }
                        getMovieData(rs.imdb_id,
                            (e, r) => {
                                if (e) {
                                    callback(new Error("Failed to get OMDb data for the title"));
                                    return;
                                }
                                callback(null, !r ? null : r);
                            });
                    });
                });
            });
        }
    }
    async.parallel(requests, function (err, res) {
        if (err) {
            error(api, event, err);
            return;
        }
        var message = "";
        var numMin = 0;
        var cacheItem = [];
        for (let i = 0; i < res.length; i++) {
            let result = res[i];
            if (result === null) {
                numMin++;
                continue;
            }
            let imdbRating = result.imdb.rating ? result.imdb.rating : 'N/A';
            let tomatoesRating = result.tomato ? `${result.tomato.meter}%` : 'N/A';
            let metacriticRating = result.metacritic ? result.metacritic : 'N/A';
            message += `${i + 1 - numMin}) ${result.title}\n\tIMDb: ${imdbRating}    RT: ${tomatoesRating}    MC: ${metacriticRating}\n`;
            cacheItem.push(result);
        }
        api.sendMessage(message, event.thread_id);
        comingSoonCache[event.thread_id] = cacheItem;
    });
}

const sendMovieData = (api, event, movie) =>
{
    api.sendImage('url', movie.poster, '', event.thread_id);

    let imdbRating = movie.imdb.rating ? movie.imdb.rating : 'N/A';
    let tomatoesRating = movie.tomato ? `${movie.tomato.meter}%` : 'N/A';
    let metacriticRating = movie.metacritic ? movie.metacritic : 'N/A';

    setTimeout(() => { // try let the image render first
        let message = `${movie.title}\n------------------------------------\n${movie.plot}\n\n`;
        message += `IMDB Rating: \t${imdbRating}\tRottenTomatoes: \t${tomatoesRating}\n`;
        message += `Metacritic:  \t${metacriticRating}\tRuntime:        \t${movie.runtime} mins\n`;

        api.sendMessage(message, event.thread_id);
    }, 500);
}

const sendIMDbMovieData = (api, event, imdbID) =>
{
    getMovieData(imdbID,
        (err, movie) => {
            if (err) {
                error(api, event, err);
                return;
            }
            sendMovieData(api, event, movie);
        }
    );
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


    if (sessionConfig['-r']) {
        error(api, event, "This hasn't been implemented yet. Blame the lazy devs.");
        return;
    }
    if (sessionConfig['-c']) {
//        api.sendMessage('"I am just going outside and may be some time"', event.thread_id);
        flicks.getComingSoon((e, r) => {
            if (e) {
                error(api, event, e);
            }
            sendComingSoon(api, event, JSON.parse(r.body).items);
        });
        return;
    }
    if (sessionConfig['-cr']) {
        let index = parseInt(sessionConfig['-cr'][0]) - 1;
        if (index === NaN || index >= comingSoonCache[event.thread_id].length) {
            error(api, event, "Well that's not a number or it's an invalid number. Silly person.")
            return;
        }
        sendMovieData(api, event, comingSoonCache[event.thread_id][index]);
        return;
    }
    if (sessionConfig['-sr']) {
        let index = parseInt(sessionConfig['-sr'][0]) - 1;
        if (index === NaN || index >= searchCache[event.thread_id].length) {
            error(api, event, "Well that's not a number or it's an invalid number. Silly person.")
            return;
        }
        movieDB.movieInfo({id: searchCache[event.thread_id][index].id, append_to_response: "external_ids"},
            (er, rs) => {
                if (er) {
                    error(api, event, er);
                }
                sendIMDbMovieData(api, event, rs.imdb_id);
            });
        return;
    }
    if (isEmptyOrSpaces(title)) {
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
                    sendIMDbMovieData(api, event, res1.imdb_id);
                });
        } else {
            error(api, event, "No results for the movie title given");
        }
    });
};
