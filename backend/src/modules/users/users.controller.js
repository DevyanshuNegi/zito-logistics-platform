var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
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
import { Controller, Get, Post, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
let UsersController = (() => {
    let _classDecorators = [ApiTags('Admin Users'), ApiBearerAuth(), UseGuards(JwtAuthGuard, RolesGuard), Controller('api/v1/admin/users')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _instanceExtraInitializers = [];
    let _findAll_decorators;
    let _create_decorators;
    let _findOne_decorators;
    let _update_decorators;
    let _lock_decorators;
    let _unlock_decorators;
    var UsersController = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _findAll_decorators = [Get(), Roles('super_admin', 'operations_admin', 'finance_admin'), ApiOperation({ summary: 'List all users with pagination and filtering' })];
            _create_decorators = [Post(), Roles('super_admin'), ApiOperation({ summary: 'Create a new user' })];
            _findOne_decorators = [Get(':id'), Roles('super_admin', 'operations_admin', 'finance_admin'), ApiOperation({ summary: 'Get a single user by ID' })];
            _update_decorators = [Patch(':id'), Roles('super_admin', 'operations_admin'), ApiOperation({ summary: 'Update a user by ID' })];
            _lock_decorators = [Patch(':id/lock'), Roles('super_admin'), ApiOperation({ summary: 'Lock a user record (prevents modification of key fields)' })];
            _unlock_decorators = [Patch(':id/unlock'), Roles('super_admin'), ApiOperation({ summary: 'Unlock a user record' })];
            __esDecorate(this, null, _findAll_decorators, { kind: "method", name: "findAll", static: false, private: false, access: { has: obj => "findAll" in obj, get: obj => obj.findAll }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: obj => "create" in obj, get: obj => obj.create }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _findOne_decorators, { kind: "method", name: "findOne", static: false, private: false, access: { has: obj => "findOne" in obj, get: obj => obj.findOne }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: obj => "update" in obj, get: obj => obj.update }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _lock_decorators, { kind: "method", name: "lock", static: false, private: false, access: { has: obj => "lock" in obj, get: obj => obj.lock }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _unlock_decorators, { kind: "method", name: "unlock", static: false, private: false, access: { has: obj => "unlock" in obj, get: obj => obj.unlock }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            UsersController = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        usersService = __runInitializers(this, _instanceExtraInitializers);
        constructor(usersService) {
            this.usersService = usersService;
        }
        async findAll(query) {
            return this.usersService.findAll(query);
        }
        async create(data, req) {
            return this.usersService.create(data, req.user);
        }
        async findOne(id) {
            return this.usersService.findOne(id);
        }
        async update(id, data, req) {
            return this.usersService.update(id, data, req.user);
        }
        async lock(id, req) {
            return this.usersService.toggleLock(id, true, req.user);
        }
        async unlock(id, req) {
            return this.usersService.toggleLock(id, false, req.user);
        }
    };
    return UsersController = _classThis;
})();
export { UsersController };
