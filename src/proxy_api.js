import express from 'express';
import authToHub from './auth';

import {
    Domain,
} from './db';
import {
    createSsl,
    deleteSsl,
} from './ssl';

const jsonParser = express.json();

export const hostToUser = async (domain, token = null, endPointType = null) => {
    const query = { where: { domain } };
    if (token) {
        query.where.token = token;
    }
    if (endPointType) {
        query.where.endPointType = endPointType;
    }
    const result = await Domain.findOne(query);
    return result;
};

const proxySet = async (req, res) => {
    const { email } = req.auth;
    const { domain, token, endPointType } = req.body;
    try {
        const [result] = await Domain.findOrCreate({
            where: {
                email,
                domain,
            },
        });
        if (token) {
            result.token = token;
        }
        if (endPointType) {
            result.endPointType = endPointType;
        }
        result.save();
        await createSsl(domain);
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).send(err);
    }
};

const proxyGet = async (req, res) => {
    const { email } = req.auth;
    try {
        const result = await Domain.findAll({
            where: {
                email,
            },
        });
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).send(err);
    }
};

const proxyDelete = async (req, res) => {
    const { email } = req.auth;
    const { domain, token, endPointType } = req.body;
    try {
        const result = await Domain.destroy({
            where: {
                email,
                domain,
                token,
                endPointType,
            },
        });
        await deleteSsl(domain);
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).send(err);
    }
};

const RouterProxyApi = express.Router();

RouterProxyApi.route('/').post(jsonParser, authToHub, proxySet);
RouterProxyApi.route('/').get(jsonParser, authToHub, proxyGet);
RouterProxyApi.route('/').delete(jsonParser, authToHub, proxyDelete);

export default RouterProxyApi;
