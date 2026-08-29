"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductFeedbackModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const ai_module_1 = require("../ai/ai.module");
const user_entity_1 = require("../users/entities/user.entity");
const notifications_module_1 = require("../notifications/notifications.module");
const product_feedback_controller_1 = require("./product-feedback.controller");
const product_feedback_service_1 = require("./product-feedback.service");
const support_assistant_service_1 = require("./support-assistant.service");
const support_context_service_1 = require("./support-context.service");
let ProductFeedbackModule = class ProductFeedbackModule {
};
exports.ProductFeedbackModule = ProductFeedbackModule;
exports.ProductFeedbackModule = ProductFeedbackModule = __decorate([
    (0, common_1.Module)({
        imports: [ai_module_1.AiModule, notifications_module_1.NotificationsModule, typeorm_1.TypeOrmModule.forFeature([user_entity_1.User])],
        controllers: [product_feedback_controller_1.ProductFeedbackController, product_feedback_controller_1.AdminProductFeedbackController, product_feedback_controller_1.PublicFaqController],
        providers: [product_feedback_service_1.ProductFeedbackService, support_context_service_1.SupportContextService, support_assistant_service_1.SupportAssistantService],
    })
], ProductFeedbackModule);
//# sourceMappingURL=product-feedback.module.js.map