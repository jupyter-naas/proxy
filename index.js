import queryString from 'query-string';
import express from 'express';
import morgan from 'morgan';
import axios from 'axios';
import Base64 from 'js-base64';

const app = express();
const port = (process.env.PORT || 3002);
app.set('port', port);
app.use(morgan('tiny'));

const singleUserPath = process.env.SINGLEUSER_PATH || '.jupyter-single-user.dev.svc.cluster.local';
const singleUserBase = process.env.SINGLEUSER_BASE || 'http://jupyter-';
const singleUserPort = process.env.NAAS_PORT || 5000;

const createUrlBase = (userNameB64) => {
    const userName = Base64.decode(userNameB64);
    if (userName === 'localhost') {
        return `http://${userName}:${singleUserPort}`;
    }
    return `${singleUserBase}${userName}${singleUserPath}:${singleUserPort}`;
};

const convertProxy = (req, res) => {
    const { userNameB64, endPointType, token } = req.params;
    if (!userNameB64) {
        res.status(200).json({ error: 'missing username' });
        return Promise.resolve();
    }
    const query = queryString.stringify(req.query || {});
    let url = createUrlBase(userNameB64);
    if (endPointType) {
        url = `${url}/${endPointType}`;
    }
    if (token) {
        url = `${url}/${token}`;
    }
    url = `${url}?${query}`;
    const responseType = 'stream';
    // eslint-disable-next-line no-console
    console.error('url', url);
    return axios.request({
        url,
        method: req.method,
        responseType,
    })
        .then((response) => {
            res.set('Content-Type', response.headers['content-type']);
            return response.data.pipe(res);
        })
        .catch((error) => res.status(400).json({ error, url }));
};

const routerProxy = express.Router();
// Proxy
routerProxy.route('/:userNameB64/:endPointType/:token').get(convertProxy);
routerProxy.route('/:userNameB64/:endPointType').get(convertProxy);
routerProxy.route('/:userNameB64').get(convertProxy);

app.use('/', routerProxy);
app.get('/', (req, res) => res.status(200).json({ status: 'ok' }));
// eslint-disable-next-line no-console
console.log('Start server');
app.listen(app.get('port'), () => {
    // eslint-disable-next-line no-console
    console.log(`Proxy PID ${process.pid}, port ${app.get('port')}, http://localhost:${app.get('port')}`);
});
