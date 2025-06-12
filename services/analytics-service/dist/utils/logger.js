"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const config_1 = require("../config");
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
        timestamp,
        level,
        service: 'analytics-service',
        message,
        ...meta,
    });
}));
exports.logger = winston_1.default.createLogger({
    level: config_1.config.env === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        new winston_1.default.transports.Console({
            format: config_1.config.env === 'development'
                ? winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                : logFormat,
        }),
    ],
    exceptionHandlers: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
        }),
    ],
    rejectionHandlers: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
        }),
    ],
});
//# sourceMappingURL=logger.js.map