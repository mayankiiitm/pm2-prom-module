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
exports.getCPULimit = exports.getFreeMemory = exports.getUsedMemory = exports.getAvailableMemory = exports.hasDockerLimitFiles = void 0;
const promises_1 = require("node:fs/promises");
const node_os_1 = __importDefault(require("node:os"));
const cpu_1 = require("./cpu");
//const MEMORY_AVAILABLE = '/sys/fs/cgroup/memory.limit_in_bytes';
//const MEMORY_USED = '/sys/fs/cgroup/memory.usage_in_bytes';
const MEMORY_AVAILABLE = '/sys/fs/cgroup/memory.max';
const MEMORY_USED = '/sys/fs/cgroup/memory.current';
const CPUS_LIMIT = '/sys/fs/cgroup/cpu.max';
const hasDockerLimitFiles = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, promises_1.access)(MEMORY_AVAILABLE, promises_1.constants.R_OK);
});
exports.hasDockerLimitFiles = hasDockerLimitFiles;
const getAvailableMemory = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = (yield (0, promises_1.readFile)(MEMORY_AVAILABLE, { encoding: 'utf8' })).trim();
        if (data === 'max') {
            return node_os_1.default.totalmem();
        }
        else {
            const memoryNumber = parseInt(data, 10);
            if (isNaN(memoryNumber)) {
                return 0;
            }
            else {
                return memoryNumber;
            }
        }
    }
    catch (_a) {
        return 0;
    }
});
exports.getAvailableMemory = getAvailableMemory;
const getUsedMemory = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = (yield (0, promises_1.readFile)(MEMORY_USED, { encoding: 'utf8' })).trim();
        const usedMemory = parseInt(data, 10);
        if (isNaN(usedMemory)) {
            return 0;
        }
        else {
            return usedMemory;
        }
    }
    catch (_b) {
        return 0;
    }
});
exports.getUsedMemory = getUsedMemory;
const getFreeMemory = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = (yield (0, promises_1.readFile)(MEMORY_AVAILABLE, { encoding: 'utf8' })).trim();
        const systemFreeMem = node_os_1.default.freemem();
        if (data === 'max') {
            // In that case we do not have any limits. Use only freemem
            return systemFreeMem;
        }
        // In that case we should calculate free memory
        const availableMemory = parseInt(data, 10);
        if (isNaN(availableMemory)) {
            // If we can not parse return OS Free memory
            return systemFreeMem;
        }
        const usedMemory = yield (0, exports.getUsedMemory)();
        if (availableMemory <= systemFreeMem) {
            // We have docker limit in the container
            return availableMemory - usedMemory;
        }
        else {
            // Limited by system available memory
            return systemFreeMem;
        }
    }
    catch (_c) {
        return 0;
    }
});
exports.getFreeMemory = getFreeMemory;
const getCPULimit = () => __awaiter(void 0, void 0, void 0, function* () {
    let count = (0, cpu_1.getCpuCount)();
    const delimeter = 100000;
    try {
        const data = (yield (0, promises_1.readFile)(CPUS_LIMIT, { encoding: 'utf8' })).trim();
        if (data) {
            const values = data.split(' ');
            if (values.length === 2) {
                const parsedValue = parseInt(values[0], 10);
                if (!isNaN(parsedValue)) {
                    count = parsedValue / delimeter;
                }
            }
        }
    }
    catch (_d) { }
    return count;
});
exports.getCPULimit = getCPULimit;
