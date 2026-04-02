"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
const pmx_1 = __importDefault(require("pmx"));
const http_1 = require("http");
const net_1 = __importDefault(require("net"));
const fs_1 = __importDefault(require("fs"));
const pm2_1 = require("./core/pm2");
const logger_1 = require("./utils/logger");
const metrics_1 = require("./metrics");
const DEFAULT_PREFIX = 'pm2';
const startPromServer = (prefix, moduleConfig) => {
    (0, metrics_1.initMetrics)(prefix);
    const serviceName = moduleConfig.service_name;
    const port = Number(moduleConfig.port);
    const hostname = moduleConfig.hostname;
    const unixSocketPath = moduleConfig.unix_socket_path;
    const promServer = (0, http_1.createServer)((_req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const mergedRegistry = (0, metrics_1.combineAllRegistries)(Boolean(moduleConfig.aggregate_app_metrics));
        mergedRegistry.setDefaultLabels({ serviceName });
        res.setHeader('Content-Type', mergedRegistry.contentType);
        res.end(yield mergedRegistry.metrics());
        return;
    }));
    const listenCallback = () => {
        const listenValue = promServer.address();
        let listenString = '';
        if (typeof listenValue === 'string') {
            listenString = listenValue;
        }
        else {
            listenString = `${listenValue === null || listenValue === void 0 ? void 0 : listenValue.address}:${listenValue === null || listenValue === void 0 ? void 0 : listenValue.port}`;
        }
        console.log(`Metrics server is available on ${listenString}`);
    };
    if (unixSocketPath) {
        promServer.on('error', function (promServerError) {
            if (promServerError.code == 'EADDRINUSE') {
                console.log(`Listen error: "${promServerError.message}". Try to remove socket...`);
                const clientSocket = new net_1.default.Socket();
                clientSocket.on('error', function (clientSocketError) {
                    if (clientSocketError.code == 'ECONNREFUSED') {
                        console.log(`Remove old socket ${unixSocketPath}`);
                        fs_1.default.unlinkSync(unixSocketPath);
                        promServer.listen(unixSocketPath);
                    }
                });
                clientSocket.connect({ path: unixSocketPath }, function () {
                    console.log('Server running, giving up...');
                    process.exit();
                });
            }
        });
        promServer.listen(unixSocketPath, listenCallback);
    }
    else {
        promServer.listen(port, hostname, listenCallback);
    }
};
pmx_1.default.initModule({
    widget: {
        el: {
            probes: true,
            actions: true,
        },
        block: {
            actions: false,
            issues: true,
            meta: true,
        },
    },
}, function (err, conf) {
    var _a, _b;
    if (err)
        return console.error(err.stack || err);
    const moduleConfig = conf.module_conf;
    (0, logger_1.initLogger)({ isDebug: moduleConfig.debug });
    (0, pm2_1.startPm2Connect)(moduleConfig);
    startPromServer((_a = moduleConfig.prefix) !== null && _a !== void 0 ? _a : DEFAULT_PREFIX, moduleConfig);
    pmx_1.default.configureModule({
        human_info: [
            ['Status', 'Module enabled'],
            ['Debug', moduleConfig.debug ? 'Enabled' : 'Disabled'],
            [
                'Aggregate apps metrics',
                moduleConfig.aggregate_app_metrics ? 'Enabled' : 'Disabled',
            ],
            ['Port', moduleConfig.port],
            ['Service name', moduleConfig.service_name ? moduleConfig.service_name : `N/A`],
            ['Check interval', `${moduleConfig.app_check_interval} ms`],
            ['Prefix', (_b = moduleConfig.prefix) !== null && _b !== void 0 ? _b : DEFAULT_PREFIX],
        ],
    });
});
