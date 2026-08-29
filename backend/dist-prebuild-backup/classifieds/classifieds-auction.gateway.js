"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ClassifiedsAuctionGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassifiedsAuctionGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const firebase_service_1 = require("../auth/firebase.service");
const defaultFrontendOrigins = process.env.NODE_ENV === 'production'
    ? ['https://piranegocios.com.br', 'https://www.piranegocios.com.br']
    : ['http://localhost:3000'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let ClassifiedsAuctionGateway = ClassifiedsAuctionGateway_1 = class ClassifiedsAuctionGateway {
    firebaseService;
    server;
    logger = new common_1.Logger(ClassifiedsAuctionGateway_1.name);
    constructor(firebaseService) {
        this.firebaseService = firebaseService;
    }
    async handleConnection(client) {
        const token = typeof client.handshake.auth?.token === 'string'
            ? client.handshake.auth.token.trim()
            : '';
        if (token) {
            try {
                const decoded = await this.firebaseService.getAuth().verifyIdToken(token);
                client.data.uid = decoded.uid;
            }
            catch {
                client.data.uid = null;
            }
        }
        await client.join('auction:lobby');
    }
    async handleDisconnect(client) {
        const room = typeof client.data.auctionRoom === 'string' ? client.data.auctionRoom : '';
        if (!room)
            return;
        queueMicrotask(() => void this.emitPresence(room));
    }
    async joinAuction(client, body) {
        const auctionId = this.auctionId(body?.auctionId);
        if (!auctionId)
            return { ok: false, message: 'Leilão inválido.' };
        const previousRoom = typeof client.data.auctionRoom === 'string' ? client.data.auctionRoom : '';
        const room = `auction:${auctionId}`;
        if (previousRoom && previousRoom !== room) {
            await client.leave(previousRoom);
            await this.emitPresence(previousRoom);
        }
        client.data.auctionRoom = room;
        await client.join(room);
        await this.emitPresence(room);
        return { ok: true, auctionId };
    }
    async leaveAuction(client) {
        const room = typeof client.data.auctionRoom === 'string' ? client.data.auctionRoom : '';
        if (!room)
            return { ok: true };
        client.data.auctionRoom = null;
        await client.leave(room);
        await this.emitPresence(room);
        return { ok: true };
    }
    publishAuctionChanged(auctionId, reason, snapshot) {
        const id = this.auctionId(auctionId);
        if (!id || !this.server)
            return;
        const payload = { auctionId: id, reason, snapshot: snapshot || null, at: new Date().toISOString() };
        this.server.to(`auction:${id}`).emit('auction:update', payload);
        this.server.to('auction:lobby').emit('auction:update', payload);
    }
    async emitPresence(room) {
        try {
            const sockets = await this.server.in(room).fetchSockets();
            const identities = new Set(sockets.map((socket) => socket.data.uid ? `user:${socket.data.uid}` : `socket:${socket.id}`));
            const auctionId = room.startsWith('auction:') ? room.slice('auction:'.length) : null;
            if (!auctionId)
                return;
            this.server.to(room).emit('auction:presence', {
                auctionId,
                online: identities.size,
                at: new Date().toISOString(),
            });
        }
        catch (error) {
            this.logger.debug(`Não foi possível atualizar presença da sala ${room}: ${String(error)}`);
        }
    }
    auctionId(value) {
        const id = String(value || '').trim();
        return UUID_RE.test(id) ? id : null;
    }
};
exports.ClassifiedsAuctionGateway = ClassifiedsAuctionGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ClassifiedsAuctionGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('auction:join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ClassifiedsAuctionGateway.prototype, "joinAuction", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('auction:leave'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ClassifiedsAuctionGateway.prototype, "leaveAuction", null);
exports.ClassifiedsAuctionGateway = ClassifiedsAuctionGateway = ClassifiedsAuctionGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/auctions',
        path: '/api/socket.io',
        cors: {
            origin: (process.env.FRONTEND_ORIGIN || defaultFrontendOrigins.join(',')).split(','),
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [firebase_service_1.FirebaseService])
], ClassifiedsAuctionGateway);
//# sourceMappingURL=classifieds-auction.gateway.js.map