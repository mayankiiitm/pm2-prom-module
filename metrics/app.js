"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppRegistry = exports.processAppMetrics = exports.deleteAppMetrics = void 0;
const prom_client_1 = __importDefault(require("prom-client"));
const logger_1 = require("../utils/logger");
const histogram_1 = require("./prom/histogram");
const summary_1 = require("./prom/summary");
const dynamicAppMetrics = {};
const DEFAULT_LABELS = ['app', 'instance'];
const parseLabels = (values) => {
    const labels = new Set();
    values.forEach((entry) => {
        Object.keys(entry.labels).forEach((label) => {
            labels.add(String(label));
        });
    });
    return Array.from(labels);
};
const createMetricByType = (metric, labels) => {
    switch (metric.type) {
        case "counter" /* MetricType.Counter */: {
            const metricEntry = new prom_client_1.default.Counter({
                name: metric.name,
                help: metric.help,
                aggregator: metric.aggregator,
                labelNames: [...DEFAULT_LABELS, ...labels],
                registers: [],
            });
            return metricEntry;
        }
        case "gauge" /* MetricType.Gauge */: {
            const metricEntry = new prom_client_1.default.Gauge({
                name: metric.name,
                help: metric.help,
                aggregator: metric.aggregator,
                labelNames: [...DEFAULT_LABELS, ...labels],
                registers: [],
            });
            return metricEntry;
        }
        case "histogram" /* MetricType.Histogram */: {
            const filteredMetrics = labels.filter((entry) => entry !== 'le');
            const metricEntry = new histogram_1.IHistogram({
                name: metric.name,
                help: metric.help,
                aggregator: metric.aggregator,
                labelNames: [...DEFAULT_LABELS, ...filteredMetrics],
                registers: [],
            });
            return metricEntry;
        }
        case "summary" /* MetricType.Summary */: {
            const filteredMetrics = labels.filter((entry) => entry !== 'quantile');
            const metricEntry = new summary_1.ISummary({
                name: metric.name,
                help: metric.help,
                aggregator: metric.aggregator,
                labelNames: [...DEFAULT_LABELS, ...filteredMetrics],
                registers: [],
            });
            return metricEntry;
        }
        default:
            return null;
    }
};
const createRegistryMetrics = (registry) => {
    const logger = (0, logger_1.getLogger)();
    const metrics = {};
    for (const [appName, appEntry] of Object.entries(dynamicAppMetrics)) {
        for (const [metricName, pidEntry] of Object.entries(appEntry)) {
            for (const [pm2id, metric] of Object.entries(pidEntry)) {
                if (!metrics[metricName]) {
                    const parsedLabels = parseLabels(metric.values);
                    const newMetricStore = createMetricByType(metric, parsedLabels);
                    if (newMetricStore) {
                        metrics[metricName] = newMetricStore;
                    }
                }
                const createdMetric = metrics[metricName];
                if (!createdMetric) {
                    logger.error(`Unsupported metric type ${metric.type} for ${metricName}`);
                }
                else {
                    // Register metric
                    registry.registerMetric(createdMetric);
                    const defaultLabels = {
                        app: appName,
                        instance: pm2id,
                    };
                    // Fill data
                    switch (metric.type) {
                        case "counter" /* MetricType.Counter */: {
                            metric.values.forEach((entry) => {
                                try {
                                    createdMetric.inc(Object.assign(Object.assign({}, entry.labels), defaultLabels), entry.value);
                                }
                                catch (error) {
                                    logger.error(error);
                                }
                            });
                            break;
                        }
                        case "gauge" /* MetricType.Gauge */: {
                            metric.values.forEach((entry) => {
                                try {
                                    createdMetric.inc(Object.assign(Object.assign({}, entry.labels), defaultLabels), entry.value);
                                }
                                catch (error) {
                                    logger.error(error);
                                }
                            });
                            break;
                        }
                        case "histogram" /* MetricType.Histogram */: {
                            createdMetric.setValues(defaultLabels, metric.values);
                            break;
                        }
                        case "summary" /* MetricType.Summary */: {
                            createdMetric.setValues(defaultLabels, metric.values);
                            break;
                        }
                        default:
                            break;
                    }
                }
            }
        }
    }
};
const getAggregatedMetrics = () => {
    const metrics = [];
    for (const [appName, appEntry] of Object.entries(dynamicAppMetrics)) {
        for (const [_metricName, pidEntry] of Object.entries(appEntry)) {
            const pidMetrics = [];
            for (const [_pm2id, metric] of Object.entries(pidEntry)) {
                const metricWithApp = Object.assign({}, metric);
                metricWithApp.values = metricWithApp.values.map((entry) => {
                    entry.labels['app'] = appName;
                    return entry;
                });
                pidMetrics.push(metricWithApp);
            }
            metrics.push(pidMetrics);
        }
    }
    return prom_client_1.default.AggregatorRegistry.aggregate(metrics);
};
const deleteAppMetrics = (appName) => {
    const logger = (0, logger_1.getLogger)();
    if (dynamicAppMetrics[appName]) {
        logger.debug(`Remove AppMetrics for app ${appName}`);
        delete dynamicAppMetrics[appName];
    }
};
exports.deleteAppMetrics = deleteAppMetrics;
const processAppMetrics = (_config, data) => {
    if (!Array.isArray(data.appResponse.metrics)) {
        return;
    }
    data.appResponse.metrics.forEach((entry) => {
        if (Array.isArray(entry.values) && entry.values.length) {
            const metricName = entry.name;
            if (!dynamicAppMetrics[data.appName]) {
                dynamicAppMetrics[data.appName] = {};
            }
            const appKey = dynamicAppMetrics[data.appName][metricName];
            if (!appKey) {
                dynamicAppMetrics[data.appName][metricName] = {};
            }
            const pm2id = String(data.pmId);
            dynamicAppMetrics[data.appName][metricName][pm2id] = entry;
        }
    });
};
exports.processAppMetrics = processAppMetrics;
const getAppRegistry = (needAggregate) => {
    if (Object.keys(dynamicAppMetrics).length) {
        if (needAggregate) {
            return getAggregatedMetrics();
        }
        else {
            const registry = new prom_client_1.default.Registry();
            createRegistryMetrics(registry);
            return registry;
        }
    }
    return undefined;
};
exports.getAppRegistry = getAppRegistry;
