"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPidsUsage = exports.getCpuCount = void 0;
const node_child_process_1 = require("node:child_process");
const node_os_1 = __importDefault(require("node:os"));
const pidusage_1 = __importDefault(require("pidusage"));
// We also get it from nproc and use the minimum of the two.
const getConcurrencyFromNProc = () => {
    try {
        return parseInt((0, node_child_process_1.execSync)('nproc', { stdio: 'pipe' }).toString().trim(), 10);
    }
    catch (error) {
        return null;
    }
};
const getCpuCount = () => {
    if (node_os_1.default.availableParallelism) {
        return node_os_1.default.availableParallelism();
    }
    const node = node_os_1.default.cpus().length;
    const nproc = getConcurrencyFromNProc();
    if (nproc === null) {
        return node;
    }
    return Math.min(nproc, node);
};
exports.getCpuCount = getCpuCount;
const getPidsUsage = (pids) => {
    return new Promise((resolve, reject) => {
        if (pids.length) {
            (0, pidusage_1.default)(pids, (err, stats) => {
                if (err) {
                    reject(err);
                }
                resolve(stats);
            });
        }
        else {
            resolve({});
        }
    });
};
exports.getPidsUsage = getPidsUsage;
