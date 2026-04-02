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
exports.deletePromAppInstancesMetrics = exports.deletePromAppMetrics = exports.combineAllRegistries = exports.initDynamicGaugeMetricClients = exports.initMetrics = exports.dynamicGaugeMetricClients = exports.metricAppPidsStatus = exports.metricAppStatus = exports.metricAppPidsMemory = exports.metricAppUptime = exports.metricAppRestartCount = exports.metricAppPidsCpuThreshold = exports.metricAppPidsCpuLast = exports.metricAppAverageCpu = exports.metricAppTotalMemory = exports.metricAppAverageMemory = exports.metricAppInstances = exports.metricAvailableApps = exports.registry = void 0;
const prom_client_1 = __importDefault(require("prom-client"));
const node_os_1 = __importDefault(require("node:os"));
const cpu_1 = require("../utils/cpu");
const docker_1 = require("../utils/docker");
const app_1 = require("./app");
const METRIC_FREE_MEMORY = 'free_memory';
const METRIC_AVAILABLE_CPU = 'cpu_count';
const METRIC_AVAILABLE_APPS = 'available_apps';
const METRIC_APP_INSTANCES = 'app_instances';
const METRIC_APP_AVERAGE_MEMORY = 'app_average_memory';
const METRIC_APP_PIDS_MEMORY = 'app_pids_memory';
const METRIC_APP_TOTAL_MEMORY = 'app_total_memory';
const METRIC_APP_AVERAGE_CPU = 'app_average_cpu';
const METRIC_APP_PIDS_CPU = 'app_pids_cpu';
const METRIC_APP_PIDS_CPU_THRESHOLD = 'app_pids_cpu_threshold';
const METRIC_APP_RESTART_COUNT = 'app_restart_count';
const METRIC_APP_UPTIME = 'app_uptime';
const METRIC_APP_STATUS = 'app_status';
const METRIC_APP_PIDS_STATUS = 'app_pids_status';
const METRIC_TOTAL_MEMORY_CONTAINER = 'container_total_memory';
const METRIC_FREE_MEMORY_CONTAINER = 'container_free_memory';
const METRIC_USED_MEMORY_CONTAINER = 'container_used_memory';
const METRIC_AVAILABLE_CPU_CONTAINER = 'container_cpu_count';
exports.registry = new prom_client_1.default.Registry();
let currentPrefix = '';
exports.dynamicGaugeMetricClients = {};
// Metrics
const initMetrics = (prefix) => {
    currentPrefix = prefix;
    new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_FREE_MEMORY}`,
        help: 'Show available host free memory (System OS)',
        collect() {
            this.set(node_os_1.default.freemem());
        },
        registers: [exports.registry],
    });
    new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_AVAILABLE_CPU}`,
        help: 'Show available CPUs count (System OS)',
        collect() {
            this.set((0, cpu_1.getCpuCount)());
        },
        registers: [exports.registry],
    });
    // Check if we in docker container
    (0, docker_1.hasDockerLimitFiles)()
        .then(() => {
        new prom_client_1.default.Gauge({
            name: `${prefix}_${METRIC_TOTAL_MEMORY_CONTAINER}`,
            help: 'Available memory in container',
            collect() {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        const memory = yield (0, docker_1.getAvailableMemory)();
                        this.set(memory);
                    }
                    catch (_a) { }
                });
            },
            registers: [exports.registry],
        });
        new prom_client_1.default.Gauge({
            name: `${prefix}_${METRIC_FREE_MEMORY_CONTAINER}`,
            help: 'Free memory in container',
            collect() {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        const memory = yield (0, docker_1.getFreeMemory)();
                        this.set(memory);
                    }
                    catch (_a) { }
                });
            },
            registers: [exports.registry],
        });
        new prom_client_1.default.Gauge({
            name: `${prefix}_${METRIC_USED_MEMORY_CONTAINER}`,
            help: 'Used memory in container',
            collect() {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        const memory = yield (0, docker_1.getUsedMemory)();
                        this.set(memory);
                    }
                    catch (_a) { }
                });
            },
            registers: [exports.registry],
        });
        new prom_client_1.default.Gauge({
            name: `${prefix}_${METRIC_AVAILABLE_CPU_CONTAINER}`,
            help: 'Available CPUs limit in container',
            collect() {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        const limit = yield (0, docker_1.getCPULimit)();
                        this.set(limit);
                    }
                    catch (_a) { }
                });
            },
            registers: [exports.registry],
        });
    })
        .catch(() => {
        //
    });
    exports.metricAvailableApps = new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_AVAILABLE_APPS}`,
        help: 'Show available apps to monitor',
        registers: [exports.registry],
    });
    // Specific app metrics
    exports.metricAppInstances = new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_APP_INSTANCES}`,
        help: 'Show app instances count',
        registers: [exports.registry],
        labelNames: ['app'],
    });
    exports.metricAppAverageMemory = new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_APP_AVERAGE_MEMORY}`,
        help: 'Show average using memory of an app',
        registers: [exports.registry],
        labelNames: ['app'],
    });
    exports.metricAppTotalMemory = new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_APP_TOTAL_MEMORY}`,
        help: 'Show total using memory of an app',
        registers: [exports.registry],
        labelNames: ['app'],
    });
    exports.metricAppAverageCpu = new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_APP_AVERAGE_CPU}`,
        help: 'Show average app cpu usage',
        registers: [exports.registry],
        labelNames: ['app'],
    });
    exports.metricAppUptime = new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_APP_UPTIME}`,
        help: 'Show app uptime in seconds',
        registers: [exports.registry],
        labelNames: ['app'],
    });
    exports.metricAppStatus = new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_APP_STATUS}`,
        help: 'Current App status. (0-unknown,1-running,2-pending,3-stopped,4-errored)',
        registers: [exports.registry],
        labelNames: ['app'],
    });
    exports.metricAppPidsStatus = new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_APP_PIDS_STATUS}`,
        help: 'Current status per app instance. (0-unknown,1-running,2-pending,3-stopped,4-errored)',
        registers: [exports.registry],
        labelNames: ['app', 'instance'],
    });
    // Metrics with instances
    exports.metricAppPidsCpuLast = new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_APP_PIDS_CPU}`,
        help: 'Show current (last) usage CPU for every app instance',
        registers: [exports.registry],
        labelNames: ['app', 'instance'],
    });
    exports.metricAppPidsCpuThreshold = new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_APP_PIDS_CPU_THRESHOLD}`,
        help: 'Show average CPU for every app instance to detect autoscale if module exists',
        registers: [exports.registry],
        labelNames: ['app', 'instance'],
    });
    exports.metricAppRestartCount = new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_APP_RESTART_COUNT}`,
        help: 'Show restart count of the app',
        registers: [exports.registry],
        labelNames: ['app', 'instance'],
    });
    exports.metricAppPidsMemory = new prom_client_1.default.Gauge({
        name: `${prefix}_${METRIC_APP_PIDS_MEMORY}`,
        help: 'Show current usage memory for every app instance',
        registers: [exports.registry],
        labelNames: ['app', 'instance'],
    });
};
exports.initMetrics = initMetrics;
const initDynamicGaugeMetricClients = (metrics) => {
    metrics.forEach((entry) => {
        exports.dynamicGaugeMetricClients[entry.key] = new prom_client_1.default.Gauge({
            name: `${currentPrefix}_${entry.key}`,
            help: entry.description,
            registers: [exports.registry],
            labelNames: ['app', 'instance'],
        });
    });
};
exports.initDynamicGaugeMetricClients = initDynamicGaugeMetricClients;
const combineAllRegistries = (needAggregate) => {
    const appRegistry = (0, app_1.getAppRegistry)(needAggregate);
    if (appRegistry) {
        return prom_client_1.default.Registry.merge([exports.registry, appRegistry]);
    }
    else {
        return exports.registry;
    }
};
exports.combineAllRegistries = combineAllRegistries;
const deletePromAppMetrics = (appName, instances) => {
    exports.metricAppInstances === null || exports.metricAppInstances === void 0 ? void 0 : exports.metricAppInstances.remove(appName);
    exports.metricAppAverageMemory === null || exports.metricAppAverageMemory === void 0 ? void 0 : exports.metricAppAverageMemory.remove(appName);
    exports.metricAppTotalMemory === null || exports.metricAppTotalMemory === void 0 ? void 0 : exports.metricAppTotalMemory.remove(appName);
    exports.metricAppAverageCpu === null || exports.metricAppAverageCpu === void 0 ? void 0 : exports.metricAppAverageCpu.remove(appName);
    exports.metricAppUptime === null || exports.metricAppUptime === void 0 ? void 0 : exports.metricAppUptime.remove(appName);
    exports.metricAppStatus === null || exports.metricAppStatus === void 0 ? void 0 : exports.metricAppStatus.remove(appName);
    (0, exports.deletePromAppInstancesMetrics)(appName, instances);
};
exports.deletePromAppMetrics = deletePromAppMetrics;
const deletePromAppInstancesMetrics = (appName, instances) => {
    instances.forEach((pmId) => {
        exports.metricAppPidsCpuLast === null || exports.metricAppPidsCpuLast === void 0 ? void 0 : exports.metricAppPidsCpuLast.remove({ app: appName, instance: pmId });
        exports.metricAppPidsCpuThreshold === null || exports.metricAppPidsCpuThreshold === void 0 ? void 0 : exports.metricAppPidsCpuThreshold.remove({ app: appName, instance: pmId });
        exports.metricAppRestartCount === null || exports.metricAppRestartCount === void 0 ? void 0 : exports.metricAppRestartCount.remove({ app: appName, instance: pmId });
        exports.metricAppPidsMemory === null || exports.metricAppPidsMemory === void 0 ? void 0 : exports.metricAppPidsMemory.remove({ app: appName, instance: pmId });
        exports.metricAppPidsStatus === null || exports.metricAppPidsStatus === void 0 ? void 0 : exports.metricAppPidsStatus.remove({ app: appName, instance: pmId });
        for (const [, entry] of Object.entries(exports.dynamicGaugeMetricClients)) {
            entry === null || entry === void 0 ? void 0 : entry.remove({ app: appName, instance: pmId });
        }
    });
};
exports.deletePromAppInstancesMetrics = deletePromAppInstancesMetrics;
