import queryString from 'query-string';
import express from 'express';
import morgan from 'morgan';
import axios from 'axios';

const app = express();
const port = (process.env.PORT || 3002)
app.set('port', port);
app.use(morgan('tiny'))

const singleUserPath = process.env.SINGLEUSER_PATH || '.jupyter-single-user.dev.svc.cluster.local';
const singleUserBase = process.env.SINGLEUSER_BASE || 'http://jupyter-';
const singleUserPort = process.env.NAAS_PORT || 5000;

const convertJupHost = (userNameB64) => {
    const b = Buffer.from(userNameB64, 'base64');
    const s = b.toString();
    return s;
};

const createUrlBase = (userNameB64) => {
    const userName = convertJupHost(userNameB64);
    if (userName === 'localhost') {
        return `http://${userName}:${singleUserPort}`;
    }
    return `${singleUserBase}${convertJupHost(userName)}${singleUserPath}:${singleUserPort}`;
}

export const convertProxy = (req, res) => {
    const { userNameB64, endPointType, token } = req.params;
    if (!userNameB64) {
        res.status(200).json({ error: 'missing username' });
        return Promise.resolve();
    }
    const query = queryString.stringify(req.query || {});
    console.log('userNameB64', userNameB64);
    let url = createUrlBase(userNameB64);
    if (endPointType) {
        url = `${url}/${endPointType}`;
    }
    if (token) {
        url = `${url}/${token}`;
    }
    url = `${url}?${query}`;
    console.log('url', url);
    const responseType = 'stream';
    return axios.request({
        url,
        method: req.method,
        responseType,
    })
        .then((response) => {
            res.set('Content-Type', response.headers['content-type']);
            return response.data.pipe(res);
        })
        .catch((error) => {
            return res.status(400).json(error);
        });
};

const routerProxy = express.Router();
// Proxy
routerProxy.route('/:userNameB64/:endPointType/:token').get(convertProxy);
routerProxy.route('/:userNameB64/:endPointType').get(convertProxy);
routerProxy.route('/:userNameB64').get(convertProxy);

app.use('/proxy', routerProxy);
app.get('/', (req, res) => {
    return res.status(200).json({ status: 'ok' });
})
console.log('Start server');
app.listen(app.get('port'), () => {
    console.log(`Proxy PID ${process.pid}, port ${app.get('port')}, http://localhost:${app.get('port')}`);
});