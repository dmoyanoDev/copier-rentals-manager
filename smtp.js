/* SmtpJS.com - v3.0.0 - Local Copy */
var Email = {
    send: function (a) {
        return new Promise(function (resolve, reject) {
            a.nocache = Math.floor(1e6 * Math.random() + 1);
            a.Action = "Send";
            var d = JSON.stringify(a);
            Email.ajax("https://smtpjs.com/v1/smtp.js", d, function (e) {
                resolve(e);
            });
        });
    },
    ajax: function (url, data, callback) {
        var xhr = Email.createCORSRequest("POST", url);
        if (xhr) {
            xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xhr.onload = function () {
                var response = xhr.responseText;
                if (callback) callback(response);
            };
            xhr.send(data);
        }
    },
    createCORSRequest: function (method, url) {
        var xhr = new XMLHttpRequest();
        if ("withCredentials" in xhr) {
            xhr.open(method, url, true);
        } else if (typeof XDomainRequest !== "undefined") {
            xhr = new XDomainRequest();
            xhr.open(method, url);
        } else {
            xhr = null;
        }
        return xhr;
    }
};
