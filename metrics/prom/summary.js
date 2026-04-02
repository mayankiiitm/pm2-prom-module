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
exports.ISummary = void 0;
const prom_client_1 = __importDefault(require("prom-client"));
class ISummary extends prom_client_1.default.Summary {
    constructor() {
        super(...arguments);
        this.values = {};
    }
    setValues(defaultLabels, values) {
        let valueKey = '';
        for (const [key, value] of Object.entries(defaultLabels)) {
            valueKey += `${key}:${value};`;
        }
        this.values[valueKey] = values.map((entry) => {
            const newEntry = Object.assign({}, entry);
            const labels = Object.assign(Object.assign({}, entry.labels), defaultLabels);
            newEntry.labels = labels;
            return newEntry;
        });
    }
    get() {
        return __awaiter(this, void 0, void 0, function* () {
            const values = [];
            for (const [, entries] of Object.entries(this.values)) {
                entries.forEach((value) => values.push(value));
            }
            return {
                name: this.name,
                help: this.help,
                type: this.type,
                values,
                aggregator: this.aggregator,
                collect: () => __awaiter(this, void 0, void 0, function* () { }),
            };
        });
    }
}
exports.ISummary = ISummary;
