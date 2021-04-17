import queryString from 'query-string';
import proxy from 'express-http-proxy';
import Base64 from 'js-base64';
import express from 'express';
import { hostToUser } from './proxy_api';
import { naasProxyHost } from './ssl';

const singleUserPath = typeof process.env.SINGLEUSER_PATH !== 'undefined' ? process.env.SINGLEUSER_PATH : '.jupyter-single-user.dev.svc.cluster.local';
const singleUserBase = typeof process.env.SINGLEUSER_BASE !== 'undefined' ? process.env.SINGLEUSER_BASE : 'http://jupyter-';
const singleUserPort = process.env.NAAS_PORT || 5000;

const { SSL } = process.env;
const decodeUser = (userNameB64) => {
    if (userNameB64 === 'localhost') {
        return `http://${userNameB64}:${singleUserPort}`;
    }
    return Base64.decode(userNameB64);
};
const createUrlBase = (userName) => `${singleUserBase}${userName}${singleUserPath}:${singleUserPort}`;

const proxyAll = (req, res, next) => {
    const { userNameB64 } = req.params;
    let { endPointType, token } = req.params;
    let userName = null;
    if (SSL && req.hostname !== naasProxyHost) {
        const data = hostToUser(req.hostname, userNameB64, endPointType);
        if (data) {
            userName = data.email;
            token = token || data.token;
            endPointType = endPointType || data.endPointType;
        } else {
            return res.status(400).json({ error: 'domain not found' });
        }
    } else {
        if (!userNameB64) {
            res.status(200).json({ message: 'ok' });
            return Promise.resolve();
        }
        userName = decodeUser(userNameB64);
    }
    const query = queryString.stringify(req.query || {});
    let url = createUrlBase(userName);
    if (endPointType) {
        url = `${url}/${endPointType}`;
    }
    if (token) {
        url = `${url}/${token}`;
    }
    url += (query ? `?${query}` : '/');
    return proxy(url, {
        preserveHostHdr: true,
        proxyReqPathResolver: () => url,
    })(req, res, next);
};
const respondFav = (req, res) => {
    const path = `${process.cwd()}/src/images/naas_fav.svg`;
    res.sendFile(path);
};

const routerProxy = express.Router();

routerProxy.route('/favicon.ico').get(respondFav);
routerProxy.route('/:userNameB64/:endPointType/:token').post(proxyAll);
routerProxy.route('/:userNameB64/:endPointType/:token').get(proxyAll);
routerProxy.route('/:userNameB64/:endPointType').get(proxyAll);
routerProxy.route('/').get(proxyAll);

export default routerProxy;
