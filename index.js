import queryString from 'query-string';
import express from 'express';
import morgan from 'morgan';
import axios from 'axios';
import Base64 from 'js-base64';
import httpErrorPages from 'http-error-pages';
import Sentry from '@sentry/node';
import Tracing from '@sentry/tracing';

const app = express();
httpErrorPages.express(app, {
    lang: 'en_US',
});
const port = (process.env.PORT || 3002);
app.set('port', port);
app.use(morgan('tiny'));
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
            new Tracing.Integrations.Express({ app }),
        ],
        tracesSampleRate: 1.0,
    });
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
}

const singleUserPath = process.env.SINGLEUSER_PATH || '.jupyter-single-user.dev.svc.cluster.local';
const singleUserBase = process.env.SINGLEUSER_BASE || 'http://jupyter-';
const singleUserPort = process.env.NAAS_PORT || 5000;

const createUrlBase = (userNameB64) => {
    if (userNameB64 === 'localhost') {
        return `http://${userNameB64}:${singleUserPort}`;
    }
    const userName = Base64.decode(userNameB64);
    return `${singleUserBase}${userName}${singleUserPath}:${singleUserPort}`;
};

const convertProxy = (req, res, next) => {
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
    return axios.request({
        url,
        method: req.method,
        responseType,
    })
        .then((response) => {
            res.set('Content-Type', response.headers['content-type']);
            if (response.headers['content-disposition']) {
                res.set('Content-Disposition', response.headers['content-disposition']);
            }
            return response.data.pipe(res);
        })
        .catch((error) => {
            if (error.response) {
                res.set('Content-Type', error.response.headers['content-type']);
                if (error.response.headers['content-disposition']) {
                    res.set('Content-Disposition', error.response.headers['content-disposition']);
                }
                return error.response.data.pipe(res);
            }
            const myError = new Error(error);
            myError.status = 404;
            return next(myError);
        });
};

const routerProxy = express.Router();
// Proxy
routerProxy.route('/:userNameB64/:endPointType/:token').get(convertProxy);
routerProxy.route('/:userNameB64/:endPointType').get(convertProxy);
routerProxy.route('/:userNameB64').get(convertProxy);

app.use('/', routerProxy);
app.get('/', (req, res) => res.status(200).json({ status: 'ok' }));
if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
}
// eslint-disable-next-line no-console
console.log('Start server');
app.listen(app.get('port'), () => {
    // eslint-disable-next-line no-console
    console.log(`Proxy PID ${process.pid}, port ${app.get('port')}, http://localhost:${app.get('port')}`);
});
