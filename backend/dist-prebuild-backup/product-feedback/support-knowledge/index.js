"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_SUPPORT_TOPICS = exports.COMPANY_SUPPORT_TOPICS = exports.CANDIDATE_SUPPORT_TOPICS = exports.PUBLIC_SUPPORT_TOPICS = exports.SHARED_SUPPORT_TOPICS = exports.SUPPORT_KNOWLEDGE_TOPICS = void 0;
const public_1 = require("./public");
Object.defineProperty(exports, "PUBLIC_SUPPORT_TOPICS", { enumerable: true, get: function () { return public_1.PUBLIC_SUPPORT_TOPICS; } });
const candidate_1 = require("./candidate");
Object.defineProperty(exports, "CANDIDATE_SUPPORT_TOPICS", { enumerable: true, get: function () { return candidate_1.CANDIDATE_SUPPORT_TOPICS; } });
const company_1 = require("./company");
Object.defineProperty(exports, "COMPANY_SUPPORT_TOPICS", { enumerable: true, get: function () { return company_1.COMPANY_SUPPORT_TOPICS; } });
const admin_1 = require("./admin");
Object.defineProperty(exports, "ADMIN_SUPPORT_TOPICS", { enumerable: true, get: function () { return admin_1.ADMIN_SUPPORT_TOPICS; } });
const shared_1 = require("./shared");
Object.defineProperty(exports, "SHARED_SUPPORT_TOPICS", { enumerable: true, get: function () { return shared_1.SHARED_SUPPORT_TOPICS; } });
exports.SUPPORT_KNOWLEDGE_TOPICS = [
    ...shared_1.SHARED_SUPPORT_TOPICS,
    ...public_1.PUBLIC_SUPPORT_TOPICS,
    ...candidate_1.CANDIDATE_SUPPORT_TOPICS,
    ...company_1.COMPANY_SUPPORT_TOPICS,
    ...admin_1.ADMIN_SUPPORT_TOPICS,
];
//# sourceMappingURL=index.js.map