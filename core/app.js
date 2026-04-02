"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = exports.PM2_METRICS = exports.APP_STATUS = void 0;
const utils_1 = require("../utils");
const MONIT_ITEMS_LIMIT = 30;
var APP_STATUS;
(function (APP_STATUS) {
    APP_STATUS[APP_STATUS["UNKNOWN"] = 0] = "UNKNOWN";
    APP_STATUS[APP_STATUS["RUNNING"] = 1] = "RUNNING";
    APP_STATUS[APP_STATUS["PENDING"] = 2] = "PENDING";
    APP_STATUS[APP_STATUS["STOPPED"] = 3] = "STOPPED";
    APP_STATUS[APP_STATUS["ERRORED"] = 4] = "ERRORED";
})(APP_STATUS || (exports.APP_STATUS = APP_STATUS = {}));
exports.PM2_METRICS = [
    { name: 'Used Heap Size', unit: 'bytes' },
    { name: 'Heap Usage', unit: '%' },
    { name: 'Heap Size', unit: 'bytes' },
    { name: 'Event Loop Latency p95', unit: 'ms' },
    { name: 'Event Loop Latency', unit: 'ms' },
    { name: 'Active handles', unit: 'number' },
    { name: 'Active requests', unit: 'number' },
    { name: 'HTTP', unit: 'req/sec' },
    { name: 'HTTP P95 Latency', unit: 'ms' },
    { name: 'HTTP Mean Latency', unit: 'ms' },
];
class App {
    constructor(name) {
        this.pids = {};
        this.startTime = 0;
        this.status = APP_STATUS.UNKNOWN;
        this.isProcessing = false;
        this.name = name;
    }
    removeNotActivePids(activePids) {
        const removedValues = [];
        Object.keys(this.pids).forEach((pid) => {
            const pidData = this.pids[pid];
            if (activePids.indexOf(Number(pid)) === -1) {
                removedValues.push({ pid, pmId: pidData.pmId });
                delete this.pids[pid];
            }
        });
        return removedValues;
    }
    updatePid(pidData) {
        const pid = pidData.id;
        if (Object.keys(this.pids).length === 0) {
            // Set start time first time when we update pids
            this.startTime = pidData.createdAt;
        }
        if (!this.pids[pid]) {
            this.pids[pid] = {
                id: pid,
                pmId: pidData.pmId,
                memory: [pidData.memory],
                cpu: [pidData.cpu],
                restartCount: pidData.restartCount,
                metrics: this.fillMetricsData(pidData.metrics),
                status: pidData.status,
            };
        }
        else {
            const memoryValues = [pidData.memory, ...this.pids[pid].memory].slice(0, MONIT_ITEMS_LIMIT);
            const cpuValues = [pidData.cpu, ...this.pids[pid].cpu].slice(0, MONIT_ITEMS_LIMIT);
            this.pids[pid].memory = memoryValues;
            this.pids[pid].cpu = cpuValues;
            this.pids[pid].restartCount = pidData.restartCount;
            this.pids[pid].metrics = this.fillMetricsData(pidData.metrics);
            this.pids[pid].status = pidData.status;
        }
        return this;
    }
    updateStatus(status) {
        switch (status) {
            case 'online':
            case 'one-launch-status':
                this.status = APP_STATUS.RUNNING;
                break;
            case 'errored':
                this.status = APP_STATUS.ERRORED;
                break;
            case 'stopped':
                this.status = APP_STATUS.STOPPED;
                break;
            case 'launching':
            case 'stopping':
                this.status = APP_STATUS.PENDING;
                break;
            default:
                this.status = APP_STATUS.UNKNOWN;
        }
    }
    getStatus() {
        return this.status;
    }
    getActivePm2Ids() {
        const values = [];
        for (const [, entry] of Object.entries(this.pids)) {
            values.push(entry.pmId);
        }
        return values;
    }
    getMonitValues() {
        return this.pids;
    }
    getAverageUsedMemory() {
        const memoryValues = this.getAveragePidsMemory();
        if (memoryValues.length) {
            return Math.round(memoryValues.reduce((sum, value) => sum + value, 0) / memoryValues.length);
        }
        return 0;
    }
    getAverageCpu() {
        const cpuValues = this.getAveragePidsCpu();
        if (cpuValues.length) {
            return Math.round(cpuValues.reduce((sum, value) => sum + value, 0) / cpuValues.length);
        }
        return 0;
    }
    getRestartCount() {
        const values = [];
        for (const [pid, entry] of Object.entries(this.pids)) {
            values.push({
                pid,
                pmId: entry.pmId,
                value: entry.restartCount,
            });
        }
        return values;
    }
    getPidPm2Metrics() {
        const values = [];
        for (const [pid, entry] of Object.entries(this.pids)) {
            values.push({
                pid,
                pmId: entry.pmId,
                metrics: entry.metrics,
            });
        }
        return values;
    }
    getCurrentPidsCpu() {
        const values = [];
        for (const [pid, entry] of Object.entries(this.pids)) {
            values.push({
                pid,
                pmId: entry.pmId,
                value: entry.cpu[0] || 0,
            });
        }
        return values;
    }
    getCurrentPidsMemory() {
        const values = [];
        for (const [pid, entry] of Object.entries(this.pids)) {
            values.push({
                pid,
                pmId: entry.pmId,
                value: entry.memory[0] || 0,
            });
        }
        return values;
    }
    getCpuThreshold() {
        const values = [];
        for (const [pid, entry] of Object.entries(this.pids)) {
            const value = Math.round(entry.cpu.reduce((sum, value) => sum + value, 0) / entry.cpu.length);
            values.push({
                pid,
                pmId: entry.pmId,
                value: value,
            });
        }
        return values;
    }
    getTotalUsedMemory() {
        const memoryValues = [];
        for (const [, entry] of Object.entries(this.pids)) {
            if (entry.memory[0]) {
                // Get the last memory value
                memoryValues.push(entry.memory[0]);
            }
        }
        return memoryValues.reduce((sum, value) => sum + value, 0);
    }
    getName() {
        return this.name;
    }
    getActiveWorkersCount() {
        return Object.keys(this.pids).length;
    }
    getPidStatuses() {
        const values = [];
        for (const [pid, entry] of Object.entries(this.pids)) {
            let statusValue = APP_STATUS.UNKNOWN;
            switch (entry.status) {
                case 'online':
                case 'one-launch-status':
                    statusValue = APP_STATUS.RUNNING;
                    break;
                case 'errored':
                    statusValue = APP_STATUS.ERRORED;
                    break;
                case 'stopped':
                    statusValue = APP_STATUS.STOPPED;
                    break;
                case 'launching':
                case 'stopping':
                    statusValue = APP_STATUS.PENDING;
                    break;
            }
            values.push({
                pid,
                pmId: entry.pmId,
                value: statusValue,
            });
        }
        return values;
    }
    getUptime() {
        if (Object.keys(this.pids).length === 0) {
            return 0;
        }
        else {
            return Math.round((Number(new Date()) - this.startTime) / 1000);
        }
    }
    getAveragePidsMemory() {
        const memoryValues = [];
        for (const [, entry] of Object.entries(this.pids)) {
            // Collect average memory for every pid
            const value = Math.round(entry.memory.reduce((sum, value) => sum + value, 0) / entry.memory.length);
            memoryValues.push(value);
        }
        return memoryValues;
    }
    getAveragePidsCpu() {
        const cpuValues = [];
        for (const [, entry] of Object.entries(this.pids)) {
            const value = Math.round(entry.cpu.reduce((sum, value) => sum + value, 0) / entry.cpu.length);
            cpuValues.push(value);
        }
        return cpuValues;
    }
    fillMetricsData(amxMetrics) {
        const metrics = {};
        if (amxMetrics) {
            const availableMetrics = exports.PM2_METRICS.map((entry) => entry.name);
            Object.keys(amxMetrics).forEach((key) => {
                if (availableMetrics.indexOf(key) !== -1) {
                    const metricKey = (0, utils_1.toUndescore)(key);
                    // Force number for metrics
                    let value = Number(amxMetrics[key].value);
                    if (amxMetrics[key].unit === 'MiB') {
                        value = value * 1024 * 1024;
                    }
                    metrics[metricKey] = value;
                }
            });
        }
        return metrics;
    }
}
exports.App = App;
