"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toUndescore = void 0;
function toUndescore(str) {
    return str.toLowerCase().replace(/\s+/g, '_');
}
exports.toUndescore = toUndescore;
