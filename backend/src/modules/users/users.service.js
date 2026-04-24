var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
let UsersService = (() => {
    let _classDecorators = [Injectable()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var UsersService = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            UsersService = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        prisma;
        audit;
        constructor(prisma, audit) {
            this.prisma = prisma;
            this.audit = audit;
        }
        async findAll(query) {
            const { role, status, skip = 0, take = 10 } = query;
            const where = { deletedAt: null };
            if (role)
                where.roles = { has: role };
            if (status)
                where.complianceStatus = status;
            const [users, total] = await Promise.all([
                this.prisma.user.findMany({
                    where,
                    skip: Number(skip),
                    take: Number(take),
                    select: {
                        id: true,
                        email: true,
                        full_name: true,
                        roles: true,
                        complianceStatus: true,
                        isActive: true,
                        createdAt: true,
                    },
                }),
                this.prisma.user.count({ where }),
            ]);
            return {
                success: true,
                data: users,
                meta: { total, skip: Number(skip), take: Number(take) },
            };
        }
        async findOne(id) {
            const user = await this.prisma.user.findFirst({
                where: { id, deletedAt: null },
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    full_name: true,
                    roles: true,
                    idNumber: true,
                    complianceStatus: true,
                    dataLocked: true,
                    isActive: true,
                    createdAt: true,
                },
            });
            if (!user)
                throw new NotFoundException('User not found');
            return { success: true, data: user };
        }
        async create(data, performingUser) {
            const tempPassword = crypto.randomBytes(6).toString('hex');
            const passwordHash = await bcrypt.hash(tempPassword, 12);
            const user = await this.prisma.user.create({
                data: {
                    ...data,
                    passwordHash,
                    complianceStatus: 'pending',
                    isActive: false,
                },
            });
            const { passwordHash: _, ...result } = user;
            await this.audit.log({
                userId: performingUser?.userId,
                action: 'USER_CREATED',
                entityType: 'USER',
                entityId: user.id,
                newValue: { roles: user.roles },
                actingAs: performingUser?.roles?.[0],
            });
            return {
                success: true,
                message: 'User created successfully',
                data: result,
            };
        }
        async update(id, data, performingUser) {
            const existing = await this.prisma.user.findFirst({
                where: { id, deletedAt: null },
            });
            if (!existing)
                throw new NotFoundException('User not found');
            const isAdmin = performingUser?.roles?.some((r) => ['super_admin', 'operations_admin', 'finance_admin'].includes(r));
            if (existing.dataLocked && !isAdmin) {
                delete data.roles;
                delete data.idNumber;
                delete data.full_name;
            }
            if (!isAdmin) {
                delete data.complianceStatus;
                delete data.isActive;
                delete data.deletedAt;
                delete data.passwordHash;
            }
            const user = await this.prisma.user.update({
                where: { id },
                data,
            });
            await this.audit.log({
                userId: performingUser?.userId,
                action: 'USER_UPDATED',
                entityType: 'USER',
                entityId: id,
                oldValue: existing,
                newValue: data,
                actingAs: performingUser?.roles?.[0],
            });
            const { passwordHash: _, ...result } = user;
            return { success: true, data: result };
        }
        async toggleLock(id, lock, performingUser) {
            await this.prisma.user.update({
                where: { id },
                data: { dataLocked: lock },
            });
            await this.audit.log({
                userId: performingUser?.userId,
                action: lock ? 'USER_LOCKED' : 'USER_UNLOCKED',
                entityType: 'USER',
                entityId: id,
                newValue: { dataLocked: lock },
                actingAs: performingUser?.roles?.[0],
            });
            return {
                success: true,
                message: `User data ${lock ? 'locked' : 'unlocked'}`,
            };
        }
        ensureActiveUser(user) {
            if (!user.isActive || user.complianceStatus !== 'active') {
                throw new ForbiddenException('User not active');
            }
        }
    };
    return UsersService = _classThis;
})();
export { UsersService };
