"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvertisingModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const admin_guard_1 = require("../admin/admin.guard");
const user_entity_1 = require("../users/entities/user.entity");
const company_entity_1 = require("../companies/entities/company.entity");
const advertising_controller_1 = require("./advertising.controller");
const advertisement_entity_1 = require("./entities/advertisement.entity");
const advertising_config_entity_1 = require("./entities/advertising-config.entity");
let AdvertisingModule = class AdvertisingModule {
};
exports.AdvertisingModule = AdvertisingModule;
exports.AdvertisingModule = AdvertisingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([advertisement_entity_1.Advertisement, advertising_config_entity_1.AdvertisingConfig, user_entity_1.User, company_entity_1.Company]),
        ],
        controllers: [advertising_controller_1.AdvertisingController],
        providers: [admin_guard_1.AdminGuard],
    })
], AdvertisingModule);
//# sourceMappingURL=advertising.module.js.map