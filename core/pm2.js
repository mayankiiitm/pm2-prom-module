"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPm2Connect = void 0;
const pm2_1 = __importDefault(require("pm2"));
const app_1 = require("./app");
const utils_1 = require("../utils");
const cpu_1 = require("../utils/cpu");
const metrics_1 = require("../metrics");
const app_2 = require("../metrics/app");
const logger_1 = require("../utils/logger");
const WORKER_CHECK_INTERVAL = 1000;
const SHOW_STAT_INTERVAL = 10000;
const APPS = {};
const isMonitoringApp = (app) => {
    const pm2_env = app.pm2_env;
    if (pm2_env.axm_options.isModule ||
        !app.name ||
        app.pm_id === undefined // pm_id might be zero
    ) {
        return false;
    }
    return true;
};
const updateAppPidsData = (workingApp, pidData) => {
    workingApp.updatePid({
        id: pidData.id,
        memory: pidData.memory,
        cpu: pidData.cpu || 0,
        pmId: pidData.pmId,
        restartCount: pidData.restartCount,
        createdAt: pidData.createdAt,
        metrics: pidData.metrics,
        status: pidData.status,
    });
};
const detectActiveApps = () => {
    const logger = (0, logger_1.getLogger)();
    pm2_1.default.list((err, apps) => {
        var _a;
        if (err)
            return console.error(err.stack || err);
        const pidsMonit = {};
        const mapAppPids = {};
        const activePM2Ids = new Set();
        const currentPidStatuses = new Map(); // "app:pm_id" → status
        apps.forEach((appInstance) => {
            var _a, _b;
            const pm2_env = appInstance.pm2_env;
            const appName = appInstance.name;
            if (!isMonitoringApp(appInstance) || !appName || appInstance.pm_id === undefined) {
                return;
            }
            // Fill all apps pids
            if (!mapAppPids[appName]) {
                mapAppPids[appName] = {
                    pids: [],
                    restartsSum: 0,
                };
            }
            mapAppPids[appName].restartsSum =
                mapAppPids[appName].restartsSum + Number(pm2_env.restart_time || 0);
            // Get the last app instance status
            mapAppPids[appName].status = (_a = appInstance.pm2_env) === null || _a === void 0 ? void 0 : _a.status;
            if (appInstance.pid && appInstance.pm_id !== undefined) {
                mapAppPids[appName].pids.push(appInstance.pid);
                // Fill active pm2 apps id to collect internal statistic
                if (pm2_env.status === 'online') {
                    activePM2Ids.add(appInstance.pm_id);
                }
                // Fill monitoring data
                pidsMonit[appInstance.pid] = {
                    cpu: 0,
                    memory: 0,
                    pmId: appInstance.pm_id,
                    id: appInstance.pid,
                    restartCount: pm2_env.restart_time || 0,
                    createdAt: pm2_env.created_at || 0,
                    metrics: pm2_env.axm_monitor,
                    status: pm2_env.status,
                };
            }
            // Track per-instance status (includes stopped/errored with pid=0)
            if (appInstance.pm_id !== undefined) {
                const statusMap = {
                    'online': 1, 'one-launch-status': 1,
                    'launching': 2, 'stopping': 2,
                    'stopped': 3,
                    'errored': 4,
                };
                const statusValue = (_b = statusMap[pm2_env.status]) !== null && _b !== void 0 ? _b : 0;
                metrics_1.metricAppPidsStatus === null || metrics_1.metricAppPidsStatus === void 0 ? void 0 : metrics_1.metricAppPidsStatus.set({ app: appName, instance: appInstance.pm_id }, statusValue);
                currentPidStatuses.set(`${appName}:${appInstance.pm_id}`, statusValue);
            }
        });
        // Remove stale pm2_app_pids_status entries for pm_ids no longer in pm2.list()
        if (metrics_1.metricAppPidsStatus) {
            const gaugeData = metrics_1.metricAppPidsStatus.hashMap;
            if (gaugeData) {
                for (const key of Object.keys(gaugeData)) {
                    const labels = (_a = gaugeData[key]) === null || _a === void 0 ? void 0 : _a.labels;
                    if ((labels === null || labels === void 0 ? void 0 : labels.app) && (labels === null || labels === void 0 ? void 0 : labels.instance) !== undefined) {
                        const lookupKey = `${labels.app}:${labels.instance}`;
                        if (!currentPidStatuses.has(lookupKey)) {
                            metrics_1.metricAppPidsStatus.remove(labels);
                        }
                    }
                }
            }
        }
        Object.keys(APPS).forEach((appName) => {
            const processingApp = mapAppPids[appName];
            // Filters apps which do not have active pids
            if (!processingApp) {
                logger.debug(`Delete ${appName} because it not longer exists`);
                const workingApp = APPS[appName];
                const instances = workingApp.getActivePm2Ids();
                // Clear app metrics
                (0, app_2.deleteAppMetrics)(appName);
                // Clear all metrics in prom-client because an app is not exists anymore
                (0, metrics_1.deletePromAppMetrics)(appName, instances);
                delete APPS[appName];
            }
            else {
                const workingApp = APPS[appName];
                if (workingApp) {
                    const activePids = processingApp.pids;
                    const removedPids = workingApp.removeNotActivePids(activePids);
                    if (removedPids.length) {
                        const removedIntances = removedPids.map((entry) => entry.pmId);
                        logger.debug(`App ${appName} clear metrics. Removed PIDs ${removedIntances.toString()}`);
                        (0, metrics_1.deletePromAppInstancesMetrics)(appName, removedIntances);
                        if (!activePids.length) {
                            // Delete app metrics because it does not have active PIDs anymore
                            logger.debug(`App ${appName} does not have active PIDs. Clear app metrics`);
                            (0, app_2.deleteAppMetrics)(appName);
                        }
                    }
                    const pidsRestartsSum = workingApp
                        .getRestartCount()
                        .reduce((accum, item) => accum + item.value, 0);
                    if (processingApp.restartsSum > pidsRestartsSum) {
                        // Reset metrics when active restart app bigger then active app
                        // This logic exist to prevent autoscaling problems if we use only !==
                        logger.debug(`App ${appName} has been restarted. Clear app metrics`);
                        (0, app_2.deleteAppMetrics)(appName);
                    }
                }
            }
        });
        // Create instances for new apps
        for (const [appName, entry] of Object.entries(mapAppPids)) {
            if (!APPS[appName]) {
                APPS[appName] = new app_1.App(appName);
            }
            const workingApp = APPS[appName];
            if (workingApp) {
                // Update status
                workingApp.updateStatus(entry.status);
            }
        }
        // Collect statistic from apps. Do it after all APPS created
        if (activePM2Ids.size > 0) {
            // logger.debug(`Collect app metrics from PIDs ${Array.from(activePM2Ids)}`);
            sendCollectStaticticBusEvent(Array.from(activePM2Ids));
        }
        // Update metric with available apps
        metrics_1.metricAvailableApps === null || metrics_1.metricAvailableApps === void 0 ? void 0 : metrics_1.metricAvailableApps.set(Object.keys(APPS).length);
        // Get all pids to monit
        const pids = Object.keys(pidsMonit);
        // Get real pids data.
        // !ATTENTION! Can not use PM2 app.monit because of incorrect values of CPU usage
        (0, cpu_1.getPidsUsage)(pids)
            .then((stats) => {
            // Fill data for all pids
            if (stats && Object.keys(stats).length) {
                for (const [pid, stat] of Object.entries(stats)) {
                    const pidId = Number(pid);
                    if (pidId && pidsMonit[pidId]) {
                        pidsMonit[pidId].cpu = Math.round(stat.cpu * 10) / 10;
                        pidsMonit[pidId].memory = stat.memory;
                    }
                }
            }
            for (const [appName, entry] of Object.entries(mapAppPids)) {
                const workingApp = APPS[appName];
                if (workingApp) {
                    // Update pids data
                    entry.pids.forEach((pidId) => {
                        const monit = pidsMonit[pidId];
                        if (monit) {
                            updateAppPidsData(workingApp, monit);
                        }
                    });
                    // Collect metrics
                    processWorkingApp(workingApp);
                }
            }
        })
            .catch((err) => {
            console.error(err.stack || err);
        });
    });
};
const startPm2Connect = (conf) => {
    const logger = (0, logger_1.getLogger)();
    pm2_1.default.connect((err) => {
        var _a;
        if (err)
            return console.error(err.stack || err);
        const additionalMetrics = app_1.PM2_METRICS.map((entry) => {
            return {
                key: (0, utils_1.toUndescore)(entry.name),
                description: `${entry.name}. Unit "${entry.unit}"`,
            };
        });
        if (additionalMetrics.length) {
            (0, metrics_1.initDynamicGaugeMetricClients)(additionalMetrics);
        }
        detectActiveApps();
        // Collect statistic from running apps
        pm2_1.default.launchBus((err, bus) => {
            if (err)
                return console.error(err.stack || err);
            logger.debug('Start bus listener');
            bus.on('process:msg', (packet) => {
                if (packet.process &&
                    packet.raw &&
                    packet.raw.topic === 'pm2-prom-module:metrics' &&
                    packet.raw.data) {
                    const { name, pm_id } = packet.process;
                    /*logger.debug(
                        `Got message from app=${name} and pid=${pm_id}. Message=${JSON.stringify(
                            packet.raw.data
                        )}`
                    );*/
                    if (name && APPS[name] && packet.raw.data.metrics) {
                        (0, app_2.processAppMetrics)(conf, {
                            pmId: pm_id,
                            appName: name,
                            appResponse: packet.raw.data,
                        });
                    }
                }
            });
        });
        // Start timer to update available apps
        setInterval(() => {
            detectActiveApps();
        }, (_a = conf.app_check_interval) !== null && _a !== void 0 ? _a : WORKER_CHECK_INTERVAL);
        if (conf.debug) {
            setInterval(() => {
                if (Object.keys(APPS).length) {
                    for (const [, app] of Object.entries(APPS)) {
                        const cpuValues = app.getCpuThreshold().map((entry) => entry.value);
                        const memory = Math.round(app.getTotalUsedMemory() / 1024 / 1024);
                        const CPU = cpuValues.length ? cpuValues.toString() : '0';
                        (0, logger_1.getLogger)().debug(`App "${app.getName()}" has ${app.getActiveWorkersCount()} worker(s). CPU: ${CPU}, Memory: ${memory}MB`);
                    }
                }
                else {
                    (0, logger_1.getLogger)().debug(`No apps available`);
                }
            }, SHOW_STAT_INTERVAL);
        }
    });
};
exports.startPm2Connect = startPm2Connect;
function processWorkingApp(workingApp) {
    const labels = { app: workingApp.getName() };
    metrics_1.metricAppInstances === null || metrics_1.metricAppInstances === void 0 ? void 0 : metrics_1.metricAppInstances.set(labels, workingApp.getActiveWorkersCount());
    metrics_1.metricAppAverageMemory === null || metrics_1.metricAppAverageMemory === void 0 ? void 0 : metrics_1.metricAppAverageMemory.set(labels, workingApp.getAverageUsedMemory());
    metrics_1.metricAppTotalMemory === null || metrics_1.metricAppTotalMemory === void 0 ? void 0 : metrics_1.metricAppTotalMemory.set(labels, workingApp.getTotalUsedMemory());
    metrics_1.metricAppAverageCpu === null || metrics_1.metricAppAverageCpu === void 0 ? void 0 : metrics_1.metricAppAverageCpu.set(labels, workingApp.getAverageCpu());
    metrics_1.metricAppUptime === null || metrics_1.metricAppUptime === void 0 ? void 0 : metrics_1.metricAppUptime.set(labels, workingApp.getUptime());
    metrics_1.metricAppStatus === null || metrics_1.metricAppStatus === void 0 ? void 0 : metrics_1.metricAppStatus.set(labels, workingApp.getStatus());
    workingApp.getCurrentPidsCpu().forEach((entry) => {
        metrics_1.metricAppPidsCpuLast === null || metrics_1.metricAppPidsCpuLast === void 0 ? void 0 : metrics_1.metricAppPidsCpuLast.set(Object.assign(Object.assign({}, labels), { instance: entry.pmId }), entry.value);
    });
    workingApp.getCpuThreshold().forEach((entry) => {
        metrics_1.metricAppPidsCpuThreshold === null || metrics_1.metricAppPidsCpuThreshold === void 0 ? void 0 : metrics_1.metricAppPidsCpuThreshold.set(Object.assign(Object.assign({}, labels), { instance: entry.pmId }), entry.value);
    });
    workingApp.getCurrentPidsMemory().forEach((entry) => {
        metrics_1.metricAppPidsMemory === null || metrics_1.metricAppPidsMemory === void 0 ? void 0 : metrics_1.metricAppPidsMemory.set(Object.assign(Object.assign({}, labels), { instance: entry.pmId }), entry.value);
    });
    workingApp.getRestartCount().forEach((entry) => {
        metrics_1.metricAppRestartCount === null || metrics_1.metricAppRestartCount === void 0 ? void 0 : metrics_1.metricAppRestartCount.set(Object.assign(Object.assign({}, labels), { instance: entry.pmId }), entry.value);
    });
    workingApp.getPidPm2Metrics().forEach((entry) => {
        Object.keys(entry.metrics).forEach((metricKey) => {
            if (metrics_1.dynamicGaugeMetricClients[metricKey]) {
                metrics_1.dynamicGaugeMetricClients[metricKey].set(Object.assign(Object.assign({}, labels), { instance: entry.pmId }), entry.metrics[metricKey]);
            }
        });
    });
}
function sendCollectStaticticBusEvent(pm2Ids) {
    // Request available metrics from all running apps
    pm2Ids.forEach((pm2id) => {
        pm2_1.default.sendDataToProcessId(pm2id, {
            topic: 'pm2-prom-module:collect',
            data: {},
            // Required fields by pm2 but we do not use them
            id: pm2id,
        }, (err) => {
            if (err)
                return console.error(`pm2-prom-module: sendDataToProcessId ${err.stack || err}`);
        });
    });
}
