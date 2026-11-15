const PACKAGE = /^\/plugins\/(com\.flickertalk\.[a-z0-9][a-z0-9.-]*)\/([0-9A-Za-z][0-9A-Za-z.+-]*)\.ftplugin$/;
const MONTHS_KEPT = 25;
const MAX_KEYS = 1000000;

function month(date) {
    return date.toISOString().slice(0, 7);
}

function downloadKey(request) {
    if (request.method !== 'GET' || request.status !== 200 || request.range) {
        return null;
    }
    const match = PACKAGE.exec(request.uri);
    if (!match) {
        return null;
    }
    const client = request.userAgent ? 'other' : 'app';
    return [month(request.now), match[1], match[2], client].join('|');
}

function count(r, now) {
    const key = downloadKey({
        method: r.method,
        status: r.status,
        uri: r.uri,
        userAgent: r.headersIn['User-Agent'],
        range: r.headersIn.Range,
        now: now || new Date()
    });
    if (!key) {
        return;
    }
    try {
        ngx.shared.downloads.incr(key, 1);
    } catch (e) {
    }
}

function prune(s, now) {
    const today = now || new Date();
    const oldest = month(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (MONTHS_KEPT - 1), 1)));
    const dict = ngx.shared.downloads;
    // keys() lists only 1024 keys unless given a larger count.
    dict.keys(MAX_KEYS).forEach(function (key) {
        if (key.slice(0, 7) < oldest) {
            dict.delete(key);
        }
    });
}

export default { downloadKey: downloadKey, count: count, prune: prune };
