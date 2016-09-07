let request = null,
    auth = { "X-Flicks-Authorization": "47d1431329133c105b61afe8ed44452b" },
    apiUrl = "http://api.flicks.co.nz/";

module.exports = function(requests) {
    request = requests;
    return {
        getMovie: function(name, callback) {
            const options = {
                url: apiUrl + "movie/" + name,
                headers: auth
            };
            request(options, callback);
        },
        getComingSoon: function(callback) {
            const options = {
                url: apiUrl + "movies/coming-soon",
                headers: auth
            };
            request(options, callback);
        },
        getNowPlaying: function(callback) {
            const options = {
                url: apiUrl + "movies/now-playing",
                headers: auth
            };
            request(options, callback);
        }
    }
}